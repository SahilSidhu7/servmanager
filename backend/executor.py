import os
import sys
import asyncio
import socket
import urllib.request
import urllib.error
import random
import time

# Always resolve scratch dir relative to this file so it works
# regardless of what cwd uvicorn was launched from.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRATCH_DIR = os.path.join(_BASE_DIR, '..', 'scratch')
SCRATCH_DIR = os.path.abspath(SCRATCH_DIR)

def _get_writable_scratch_dir(path: str) -> str:
    try:
        os.makedirs(path, exist_ok=True)
        # Verify it is actually writable by writing a small test file
        test_file = os.path.join(path, '.write_test')
        with open(test_file, 'w') as f:
            f.write('test')
        os.unlink(test_file)
        return path
    except Exception:
        import tempfile
        fallback_path = os.path.join(tempfile.gettempdir(), 'servmanager-scratch')
        try:
            os.makedirs(fallback_path, exist_ok=True)
            return fallback_path
        except Exception:
            return tempfile.gettempdir()

SCRATCH_DIR = _get_writable_scratch_dir(SCRATCH_DIR)


# Helper to check if a TCP port is active (listening)
async def check_tcp_port(port: int) -> bool:
    def sync_check():
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        try:
            s.connect(('127.0.0.1', port))
            s.close()
            return True
        except Exception:
            return False
    return await asyncio.to_thread(sync_check)

# Helper to perform HTTP request
async def http_call(url: str, method: str = 'GET', body: str = '') -> dict:
    def sync_call():
        try:
            req = urllib.request.Request(url, method=method)
            if body:
                req.data = body.encode('utf-8')
                req.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(req, timeout=5) as response:
                return {
                    "statusCode": response.status,
                    "body": response.read().decode('utf-8', errors='ignore'),
                    "success": 200 <= response.status < 300
                }
        except urllib.error.HTTPError as e:
            try:
                error_body = e.read().decode('utf-8', errors='ignore')
            except Exception:
                error_body = ""
            return {
                "statusCode": e.code,
                "body": error_body or f"HTTP Error {e.code}",
                "success": False
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "body": f"Error: {str(e)}",
                "success": False
            }
    return await asyncio.to_thread(sync_call)

class ScriptExecutor:
    def __init__(self):
        self.active_processes = {}  # run_id -> dict with process details, cancel_flag

    async def run(self, run_id: str, script_data: dict, on_log) -> dict:
        script_type = script_data.get("type", "shell")
        if script_type == "workflow":
            return await self.run_workflow(run_id, script_data.get("workflow", {}), on_log)
        else:
            return await self.run_shell(run_id, script_data.get("content", ""), on_log)

    def write_temp_script(self, content: str) -> str:
        # Determine shebang & file extension
        is_bash = "#!/bin/bash" in content or "#!/bin/sh" in content
        ext = '.sh' if not (sys.platform == 'win32') else ('.sh' if is_bash else '.bat')
        
        filename = f"script_{int(time.time())}_{random.randint(1000, 9999)}{ext}"
        file_path = os.path.join(SCRATCH_DIR, filename)

        # Normalize line endings
        normalized_content = content.replace('\r\n', '\n')
        if sys.platform == 'win32' and ext == '.bat':
            normalized_content = normalized_content.replace('\n', '\r\n')

        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            f.write(normalized_content)
            
        if sys.platform != 'win32':
            os.chmod(file_path, 0o755)
            
        return file_path

    async def run_shell(self, run_id: str, script_content: str, on_log) -> dict:
        temp_file = self.write_temp_script(script_content)
        process = None
        is_cancelled = False

        self.active_processes[run_id] = {
            "type": "shell",
            "temp_file": temp_file,
            "process": None,
            "cancel": False
        }

        try:
            is_win = sys.platform == 'win32'
            
            # Select execution shell command
            if is_win:
                is_bash = "#!/bin/bash" in script_content or "#!/bin/sh" in script_content
                has_bash = False
                
                if is_bash:
                    try:
                        # Non-blocking check for bash in PATH
                        proc_check = await asyncio.create_subprocess_exec(
                            'bash', '--version',
                            stdout=asyncio.subprocess.DEVNULL,
                            stderr=asyncio.subprocess.DEVNULL
                        )
                        await proc_check.wait()
                        has_bash = (proc_check.returncode == 0)
                    except Exception:
                        has_bash = False

                if is_bash and has_bash:
                    cmd_args = ['bash', temp_file]
                else:
                    # Strip shebang and write as batch
                    clean_content = script_content
                    if script_content.startswith('#!'):
                        lines = script_content.split('\n')
                        lines.pop(0)
                        clean_content = '\n'.join(lines)
                    
                    bat_file = temp_file.replace('.sh', '.bat')
                    if not bat_file.endswith('.bat'):
                        bat_file += '.bat'
                        
                    with open(bat_file, 'w', encoding='utf-8', newline='\r\n') as f:
                        f.write(clean_content)
                    
                    # Remove original temp file
                    if temp_file != bat_file:
                        try:
                            os.unlink(temp_file)
                        except Exception:
                            pass
                    
                    temp_file = bat_file
                    self.active_processes[run_id]["temp_file"] = temp_file
                    cmd_args = ['cmd.exe', '/c', bat_file]
            else:
                cmd_args = ['bash', temp_file]

            # Spawn the subprocess asynchronously
            process = await asyncio.create_subprocess_exec(
                *cmd_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            self.active_processes[run_id]["process"] = process

            # Reader tasks for stdout & stderr
            async def read_stream(stream, prefix=""):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded_line = line.decode('utf-8', errors='ignore')
                    on_log(f"{prefix}{decoded_line}")

            # Run stream readers concurrently
            await asyncio.gather(
                read_stream(process.stdout),
                read_stream(process.stderr, prefix="[stderr] ")
            )

            # Wait for exit
            returncode = await process.wait()
            
            # Check if cancellation was triggered
            if self.active_processes.get(run_id, {}).get("cancel", False):
                is_cancelled = True

        except Exception as e:
            on_log(f"[system-err] Spawn execution failed: {str(e)}\n")
            returncode = 99
        finally:
            # Clean up temp file
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception:
                pass
            
            self.active_processes.pop(run_id, None)

        if is_cancelled:
            on_log('\n[Execution Cancelled by User]\n')
            return {"code": -1, "status": "cancelled"}
        else:
            on_log(f'\nProcess exited with code {returncode}\n')
            return {"code": returncode, "status": "success" if returncode == 0 else "failure"}

    async def run_workflow(self, run_id: str, workflow_data: dict, on_log) -> dict:
        steps = workflow_data.get("steps", [])
        current_step_index = 0
        last_output = ""
        last_exit_code = 0
        
        self.active_processes[run_id] = {
            "type": "workflow",
            "cancel": False,
            "current_child_run_id": None
        }

        on_log(f"=== STARTING WORKFLOW ===\nTotal Steps: {len(steps)}\n\n")

        while current_step_index < len(steps) and not self.active_processes.get(run_id, {}).get("cancel", False):
            step = steps[current_step_index]
            on_log(f"[Step {current_step_index + 1}/{len(steps)}] Running: \"{step.get('name')}\"...\n")

            step_success = True
            step_output = ""
            step_code = 0

            step_type = step.get("type")
            config = step.get("config", {})

            try:
                if step_type == 'command':
                    cmd = config.get("command")
                    if not cmd:
                        on_log(f"[Error] No command specified for step: {step.get('name')}\n")
                        step_success = False
                        step_code = 1
                    else:
                        sub_run_id = f"{run_id}_step_{current_step_index}"
                        self.active_processes[run_id]["current_child_run_id"] = sub_run_id
                        
                        cmd_output_lines = []
                        def cmd_log(log_line):
                            cmd_output_lines.append(log_line)
                            on_log(f"  | {log_line}")

                        # Execute command
                        res = await self.run_shell(sub_run_id, cmd, cmd_log)
                        
                        self.active_processes[run_id]["current_child_run_id"] = None
                        step_code = res.get("code", 0)
                        step_success = res.get("status") == 'success'
                        step_output = "".join(cmd_output_lines)
                        
                elif step_type == 'check_port':
                    port_val = config.get("port")
                    try:
                        port = int(port_val)
                        on_log(f"  Checking if TCP port {port} is active...\n")
                        is_active = await check_tcp_port(port)
                        if is_active:
                            step_output = f"Port {port} is ACTIVE (listening)."
                            on_log(f"  [OK] {step_output}\n")
                            step_code = 0
                            step_success = True
                        else:
                            step_output = f"Port {port} is INACTIVE (not listening)."
                            on_log(f"  [WARN] {step_output}\n")
                            step_code = 1
                            step_success = False
                    except Exception as pe:
                        on_log(f"[Error] Invalid port configuration: {pe}\n")
                        step_success = False
                        step_code = 1
                        
                elif step_type == 'http_request':
                    url = config.get("url")
                    method = config.get("method", "GET")
                    body = config.get("body", "")
                    
                    if not url:
                        on_log(f"[Error] No URL specified for step: {step.get('name')}\n")
                        step_success = False
                        step_code = 1
                    else:
                        on_log(f"  Sending HTTP {method} to {url}...\n")
                        res = await http_call(url, method, body)
                        step_output = res["body"]
                        on_log(f"  Response Status Code: {res['statusCode']}\n")
                        on_log(f"  Response Size: {len(res['body'])} chars\n")
                        step_code = 0 if res["success"] else 1
                        step_success = res["success"]
                        
                elif step_type == 'delay':
                    try:
                        seconds = float(config.get("seconds", 1))
                    except ValueError:
                        seconds = 1.0
                    on_log(f"  Sleeping for {seconds} seconds...\n")
                    await asyncio.sleep(seconds)
                    step_code = 0
                    step_success = True
                    
                elif step_type == 'log':
                    msg = config.get("message", "")
                    on_log(f"  [LOG] {msg}\n")
                    step_output = msg
                    step_code = 0
                    step_success = True
                    
                elif step_type == 'conditional':
                    match_type = config.get("matchType", "exitcode")
                    compare_value = config.get("value", "")
                    next_step_id = config.get("nextStepId")
                    else_step_id = config.get("elseStepId")

                    condition_met = False
                    if match_type == 'exitcode':
                        condition_met = str(last_exit_code) == str(compare_value)
                    elif match_type == 'contains':
                        condition_met = compare_value in last_output
                    elif match_type == 'equals':
                        condition_met = last_output.strip() == compare_value.strip()

                    on_log(f"  Condition: [Type: {match_type}, CompareTo: \"{compare_value}\"]. Evaluated: {condition_met}\n")
                    
                    target_step_id = next_step_id if condition_met else else_step_id
                    if target_step_id:
                        target_index = -1
                        for i, s in enumerate(steps):
                            if s.get("id") == target_step_id:
                                target_index = i
                                break
                        if target_index != -1:
                            on_log(f"  Branching to step: \"{steps[target_index].get('name')}\" (index {target_index + 1})\n")
                            current_step_index = target_index
                            continue
                        else:
                            on_log(f"  [Error] Target branch step ID \"{target_step_id}\" not found.\n")
                    else:
                        on_log("  No branch specified for this condition. Continuing normally.\n")
                    step_code = 0
                    step_success = True

            except Exception as e:
                on_log(f"  [Exception] {str(e)}\n")
                step_success = False
                step_code = 99

            last_output = step_output
            last_exit_code = step_code

            on_log(f"[Step Finished] Status: {'SUCCESS' if step_success else 'FAILURE'} (Code: {step_code})\n\n")
            current_step_index += 1

        is_cancelled = self.active_processes.get(run_id, {}).get("cancel", False)
        self.active_processes.pop(run_id, None)

        if is_cancelled:
            on_log('=== WORKFLOW CANCELLED BY USER ===\n')
            return {"code": -1, "status": "cancelled"}
        else:
            final_status = "success" if last_exit_code == 0 else "failure"
            on_log(f"=== WORKFLOW COMPLETE ===\nFinal Status: {final_status.upper()} (Code: {last_exit_code})\n")
            return {"code": last_exit_code, "status": final_status}

    def kill(self, run_id: str) -> bool:
        task_info = self.active_processes.get(run_id)
        if not task_info:
            return False

        task_info["cancel"] = True

        # Kill child shell execution first if workflow is active
        if task_info["type"] == "workflow" and task_info["current_child_run_id"]:
            self.kill(task_info["current_child_run_id"])

        process = task_info.get("process")
        if process:
            try:
                if sys.platform == 'win32':
                    # On Windows, spawn a taskkill command to terminate the entire process tree
                    import subprocess
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(process.pid)], 
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    process.terminate()
            except Exception:
                pass
                
        return True
