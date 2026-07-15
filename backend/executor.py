import os
import sys
import asyncio
import random
import time

# Always resolve scratch dir relative to this file so it works
# regardless of what cwd uvicorn was launched from.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRATCH_DIR = os.path.abspath(os.path.join(_BASE_DIR, '..', 'scratch'))


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


class ScriptExecutor:
    def __init__(self):
        self.active_processes = {}  # run_id -> dict with process details, cancel_flag

    async def run(self, run_id: str, script_data: dict, on_log) -> dict:
        return await self.run_shell(run_id, script_data.get("content", ""), on_log)

    def write_temp_script(self, content: str) -> str:
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
            os.chmod(file_path, 0o700)

        return file_path

    async def run_shell(self, run_id: str, script_content: str, on_log) -> dict:
        temp_file = self.write_temp_script(script_content)
        process = None
        is_cancelled = False
        returncode = 99

        self.active_processes[run_id] = {
            "temp_file": temp_file,
            "process": None,
            "cancel": False
        }

        try:
            is_win = sys.platform == 'win32'

            if is_win:
                is_bash = "#!/bin/bash" in script_content or "#!/bin/sh" in script_content
                has_bash = False

                if is_bash:
                    try:
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

            process = await asyncio.create_subprocess_exec(
                *cmd_args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            self.active_processes[run_id]["process"] = process

            async def read_stream(stream, prefix=""):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded_line = line.decode('utf-8', errors='ignore')
                    on_log(f"{prefix}{decoded_line}")

            await asyncio.gather(
                read_stream(process.stdout),
                read_stream(process.stderr, prefix="[stderr] ")
            )

            returncode = await process.wait()

            if self.active_processes.get(run_id, {}).get("cancel", False):
                is_cancelled = True

        except Exception as e:
            on_log(f"[system-err] Spawn execution failed: {str(e)}\n")
            returncode = 99
        finally:
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except Exception:
                pass

            self.active_processes.pop(run_id, None)

        if is_cancelled:
            on_log('\n[Execution cancelled by user]\n')
            return {"code": -1, "status": "cancelled"}
        else:
            on_log(f'\nProcess exited with code {returncode}\n')
            return {"code": returncode, "status": "success" if returncode == 0 else "failure"}

    def kill(self, run_id: str) -> bool:
        task_info = self.active_processes.get(run_id)
        if not task_info:
            return False

        task_info["cancel"] = True

        process = task_info.get("process")
        if process:
            try:
                if sys.platform == 'win32':
                    # Terminate the entire process tree
                    import subprocess
                    subprocess.run(['taskkill', '/F', '/T', '/PID', str(process.pid)],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    process.terminate()
            except Exception:
                pass

        return True
