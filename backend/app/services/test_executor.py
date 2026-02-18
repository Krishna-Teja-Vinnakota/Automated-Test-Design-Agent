"""Test execution service with Jest, Playwright, and Cypress support."""
import subprocess
import json
import tempfile
import shutil
import base64
from typing import Dict, Any, List
from pathlib import Path
import re
import os


class TestExecutor:
    """Service for executing tests with multiple frameworks."""
    
    def __init__(self, target_url: str = "http://localhost:5173"):
        self.target_url = target_url
        # Template directory (shared by all frameworks)
        self.template_dir = Path(__file__).parent.parent / "templates" / "test_frameworks"
    
    def set_target_url(self, url: str):
        """Update the target URL for tests."""
        self.target_url = url
    
    def execute_frontend_tests(self, test_code: str, framework: str = "playwright", target_url: str = None) -> Dict[str, Any]:
        """Route to appropriate framework for frontend tests."""
        if target_url:
            self.set_target_url(target_url)
        
        if framework.lower() == "playwright":
            return self._execute_playwright(test_code, self.target_url)
        elif framework.lower() == "cypress":
            return self._execute_cypress(test_code, self.target_url)
        else:
            return {
                "success": False,
                "error": f"Unsupported frontend framework: {framework}",
                "testResults": []
            }
    
    def execute_backend_tests(self, test_code: str, framework: str = "jest", target_url: str = None) -> Dict[str, Any]:
        """Route to appropriate framework for backend tests."""
        if framework.lower() == "jest":
            return self._execute_jest(test_code, target_url or self.target_url)
        elif framework.lower() == "pytest":
            return self._execute_pytest(test_code)
        else:
            return {
                "success": False,
                "error": f"Unsupported backend framework: {framework}",
                "testResults": []
            }
    
    def _execute_playwright(self, test_code: str, target_url: str) -> Dict[str, Any]:
        """Execute Playwright tests."""
        print(f"[Playwright] Starting test execution...")
        temp_dir = Path(tempfile.mkdtemp(prefix="qa_wizard_pw_"))
        
        try:
            # Copy Playwright config
            shutil.copy(
                self.template_dir / "playwright.config.ts",
                temp_dir / "playwright.config.ts"
            )
            
            # Copy package.json for Playwright
            shutil.copy(
                self.template_dir / "playwright.package.json",
                temp_dir / "package.json"
            )
            
            # Copy node_modules if exists, otherwise install
            node_modules_src = self.template_dir / "node_modules"
            if node_modules_src.exists():
                print(f"[Playwright] Copying node_modules from template...")
                shutil.copytree(node_modules_src, temp_dir / "node_modules")
            else:
                print(f"[Playwright] Installing dependencies...")
                result = subprocess.run(
                    "npm install",
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    cwd=str(temp_dir),
                    shell=True,
                    timeout=300
                )
                if result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"npm install failed: {result.stderr}",
                        "testResults": []
                    }
                
                # Install Chromium browser
                print(f"[Playwright] Installing Chromium...")
                subprocess.run(
                    "npx playwright install chromium",
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    cwd=str(temp_dir),
                    shell=True,
                    timeout=600
                )
            
            # Create tests directory
            (temp_dir / "tests").mkdir()
            
            # Write test file
            test_file = temp_dir / "tests" / "test.spec.ts"
            test_file.write_text(test_code, encoding='utf-8')
            print(f"[Playwright] Test file written: {test_file}")
            
            # Set environment variable and run tests
            env = os.environ.copy()
            env['TARGET_URL'] = target_url
            
            print(f"[Playwright] Running tests against {target_url}...")
            result = subprocess.run(
                "npx playwright test",
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',  # Replace invalid characters instead of failing
                cwd=str(temp_dir),
                env=env,
                shell=True,
                timeout=600
            )
            
            print(f"[Playwright] Exit code: {result.returncode}")
            
            # Parse results from JSON file
            results_file = temp_dir / "test-results" / "results.json"
            if results_file.exists():
                json_output = json.loads(results_file.read_text(encoding='utf-8'))
                parsed_results = self._parse_playwright_json(json_output)
                
                # Extract screenshots
                screenshots = self._extract_screenshots(temp_dir / "test-results")
                if screenshots:
                    parsed_results['screenshots'] = screenshots
                
                return parsed_results
            else:
                # Fallback to console parsing
                stdout = result.stdout or ""
                stderr = result.stderr or ""
                return self._parse_console_output(stdout, stderr, result.returncode)
        
        except Exception as e:
            print(f"[Playwright] Error: {e}")
            return {
                "success": False,
                "error": str(e),
                "testResults": []
            }
        finally:
            # Cleanup
            try:
                shutil.rmtree(temp_dir)
                print(f"[Playwright] Cleaned up temp directory")
            except Exception as e:
                print(f"[Playwright] Cleanup warning: {e}")
    
    def _execute_cypress(self, test_code: str, target_url: str) -> Dict[str, Any]:
        """Execute Cypress tests."""
        print(f"[Cypress] Starting test execution...")
        temp_dir = Path(tempfile.mkdtemp(prefix="qa_wizard_cy_"))
        
        try:
            # Copy Cypress config
            shutil.copy(
                self.template_dir / "cypress.config.js",
                temp_dir / "cypress.config.js"
            )
            
            # Copy package.json for Cypress
            shutil.copy(
                self.template_dir / "cypress.package.json",
                temp_dir / "package.json"
            )
            
            # Copy node_modules if exists, otherwise install
            node_modules_src = self.template_dir / "node_modules"
            if node_modules_src.exists():
                print(f"[Cypress] Copying node_modules from template...")
                shutil.copytree(node_modules_src, temp_dir / "node_modules")
            else:
                print(f"[Cypress] Installing dependencies...")
                result = subprocess.run(
                    "npm install",
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    cwd=str(temp_dir),
                    shell=True,
                    timeout=300
                )
                if result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"npm install failed: {result.stderr}",
                        "testResults": []
                    }
                
                # Install Cypress binary
                print(f"[Cypress] Installing Cypress binary...")
                subprocess.run(
                    "npx cypress install",
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    cwd=str(temp_dir),
                    shell=True,
                    timeout=600
                )
            
            # Create Cypress directory structure
            (temp_dir / "cypress" / "e2e").mkdir(parents=True)
            
            # Write test file
            test_file = temp_dir / "cypress" / "e2e" / "test.cy.js"
            test_file.write_text(test_code, encoding='utf-8')
            print(f"[Cypress] Test file written: {test_file}")
            
            # Set environment variable and run tests
            env = os.environ.copy()
            env['TARGET_URL'] = target_url
            
            print(f"[Cypress] Running tests against {target_url}...")
            result = subprocess.run(
                "npx cypress run --browser chrome",
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',  # Replace invalid characters instead of failing
                cwd=str(temp_dir),
                env=env,
                shell=True,
                timeout=600
            )
            
            print(f"[Cypress] Exit code: {result.returncode}")
            
            # Parse results from console output (handle None values)
            stdout = result.stdout or ""
            stderr = result.stderr or ""
            parsed_results = self._parse_cypress_output(stdout, stderr, result.returncode)
            
            # Extract screenshots
            screenshots = self._extract_screenshots(temp_dir / "cypress" / "screenshots")
            if screenshots:
                parsed_results['screenshots'] = screenshots
            
            return parsed_results
        
        except Exception as e:
            print(f"[Cypress] Error: {e}")
            return {
                "success": False,
                "error": str(e),
                "testResults": []
            }
        finally:
            # Cleanup
            try:
                shutil.rmtree(temp_dir)
                print(f"[Cypress] Cleaned up temp directory")
            except Exception as e:
                print(f"[Cypress] Cleanup warning: {e}")
    
    def _execute_jest(self, test_code: str, target_url: str) -> Dict[str, Any]:
        """Execute Jest tests with template setup."""
        print(f"[Jest] Starting test execution...")
        temp_dir = Path(tempfile.mkdtemp(prefix="qa_wizard_jest_"))
        
        try:
            # Copy Jest config
            shutil.copy(
                self.template_dir / "jest.config.js",
                temp_dir / "jest.config.js"
            )
            
            # Copy package.json for Jest
            shutil.copy(
                self.template_dir / "jest.package.json",
                temp_dir / "package.json"
            )
            
            # Copy node_modules if exists, otherwise install
            node_modules_src = self.template_dir / "node_modules"
            if node_modules_src.exists():
                print(f"[Jest] Copying node_modules from template...")
                shutil.copytree(node_modules_src, temp_dir / "node_modules")
            else:
                print(f"[Jest] Installing dependencies...")
                result = subprocess.run(
                    "npm install",
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace',
                    cwd=str(temp_dir),
                    shell=True,
                    timeout=300
                )
                if result.returncode != 0:
                    return {
                        "success": False,
                        "error": f"npm install failed: {result.stderr}",
                        "testResults": []
                    }
            
            # Write test file
            test_file = temp_dir / "test.spec.js"
            test_file.write_text(test_code, encoding='utf-8')
            print(f"[Jest] Test file written: {test_file}")
            
            # Set up environment variables (including TARGET_URL)
            env = os.environ.copy()
            env['TARGET_URL'] = target_url
            
            # Run Jest with JSON output
            print(f"[Jest] Running tests against {target_url}...")
            result = subprocess.run(
                "npx jest --json --testLocationInResults",
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                cwd=str(temp_dir),
                env=env,
                shell=True,
                timeout=300
            )
            
            print(f"[Jest] Exit code: {result.returncode}")
            
            # Parse JSON results
            try:
                stdout = result.stdout or "{}"
                results = json.loads(stdout)
                return self._parse_jest_results(results)
            except json.JSONDecodeError:
                return self._parse_jest_console(result.stdout or "", result.stderr or "", result.returncode)
        
        except Exception as e:
            print(f"[Jest] Error: {e}")
            return {
                "success": False,
                "error": str(e),
                "testResults": []
            }
        finally:
            # Cleanup
            try:
                shutil.rmtree(temp_dir)
                print(f"[Jest] Cleaned up temp directory")
            except Exception as e:
                print(f"[Jest] Cleanup warning: {e}")
    
    def _execute_pytest(self, test_code: str) -> Dict[str, Any]:
        """Execute Pytest tests (simple, no template needed)."""
        print(f"[Pytest] Starting test execution...")
        temp_dir = Path(tempfile.mkdtemp(prefix="qa_wizard_pytest_"))
        
        try:
            # Write test file
            test_file = temp_dir / "test_api.py"
            test_file.write_text(test_code, encoding='utf-8')
            print(f"[Pytest] Test file written: {test_file}")
            
            # Run Pytest
            result = subprocess.run(
                f"python -m pytest {test_file} -v --tb=short",
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                cwd=str(temp_dir),
                shell=True,
                timeout=300
            )
            
            print(f"[Pytest] Exit code: {result.returncode}")
            
            return self._parse_pytest_output(result)
        
        except Exception as e:
            print(f"[Pytest] Error: {e}")
            return {
                "success": False,
                "error": str(e),
                "testResults": []
            }
        finally:
            # Cleanup
            try:
                shutil.rmtree(temp_dir)
                print(f"[Pytest] Cleaned up temp directory")
            except Exception as e:
                print(f"[Pytest] Cleanup warning: {e}")
    
    def _extract_screenshots(self, screenshots_dir: Path) -> List[Dict[str, str]]:
        """Extract screenshots and convert to base64."""
        screenshots = []
        
        if not screenshots_dir.exists():
            return screenshots
        
        for screenshot_file in screenshots_dir.rglob("*.png"):
            try:
                with open(screenshot_file, 'rb') as f:
                    image_data = base64.b64encode(f.read()).decode('utf-8')
                    screenshots.append({
                        "filename": screenshot_file.name,
                        "data": f"data:image/png;base64,{image_data}"
                    })
            except Exception as e:
                print(f"Failed to read screenshot {screenshot_file}: {e}")
        
        return screenshots
    
    def _parse_playwright_json(self, json_output: Dict) -> Dict[str, Any]:
        """Parse Playwright JSON reporter output."""
        test_results = []
        total_duration = 0
        
        def process_suite(suite):
            nonlocal total_duration
            results = []
            
            for spec in suite.get("specs", []):
                title = spec.get("title", "Unknown")
                tc_match = re.search(r'(TC-\d+)', title)
                test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results) + len(results) + 1:03d}"
                
                status = "passed"
                error_msg = None
                duration = 0
                
                for test in spec.get("tests", []):
                    for run in test.get("results", []):
                        duration += run.get("duration", 0)
                        run_status = run.get("status", "")
                        if run_status not in ["passed", "skipped"]:
                            status = "failed"
                            errors = run.get("errors", [])
                            if errors:
                                error_msg = errors[0].get("message", "Test failed") if isinstance(errors[0], dict) else str(errors[0])
                            else:
                                error_obj = run.get("error", {})
                                if isinstance(error_obj, dict):
                                    error_msg = error_obj.get("message", "Test failed")
                                elif error_obj:
                                    error_msg = str(error_obj)
                
                total_duration += duration
                
                results.append({
                    "id": test_id,
                    "name": title,
                    "title": title,
                    "status": status,
                    "duration": f"{duration}ms",
                    "error": {"message": error_msg} if error_msg else None
                })
            
            for child in suite.get("suites", []):
                results.extend(process_suite(child))
            
            return results
        
        for suite in json_output.get("suites", []):
            test_results.extend(process_suite(suite))
        
        passed = len([t for t in test_results if t["status"] == "passed"])
        failed = len([t for t in test_results if t["status"] == "failed"])
        
        return {
            "success": failed == 0,
            "testResults": test_results,
            "duration": f"{total_duration}ms",
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed
            }
        }
    
    def _parse_cypress_output(self, stdout: str, stderr: str, return_code: int) -> Dict[str, Any]:
        """Parse Cypress console output."""
        test_results = []
        output = stdout + stderr
        
        # Parse Cypress output for test results
        lines = output.split('\n')
        for i, line in enumerate(lines):
            if '✓' in line or '✔' in line:
                match = re.search(r'✓\s+(.+?)\s+\((\d+)ms\)', line)
                if match:
                    title = match.group(1).strip()
                    duration = match.group(2)
                    tc_match = re.search(r'(TC-\d+)', title)
                    test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                    
                    test_results.append({
                        "id": test_id,
                        "name": title,
                        "title": title,
                        "status": "passed",
                        "duration": f"{duration}ms",
                        "error": None
                    })
            elif '✘' in line or '✗' in line or '×' in line or '(failed)' in line.lower():
                match = re.search(r'[✘✗×]\s+(.+?)(?:\s+\((\d+)ms\))?', line)
                if match:
                    title = match.group(1).strip()
                    duration = match.group(2) if match.group(2) else "0"
                    tc_match = re.search(r'(TC-\d+)', title)
                    test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                    
                    # Look for error message in following lines
                    error_msg = "Test failed"
                    for j in range(i+1, min(i+10, len(lines))):
                        if 'Error:' in lines[j] or 'AssertionError' in lines[j]:
                            error_msg = lines[j].strip()
                            break
                    
                    test_results.append({
                        "id": test_id,
                        "name": title,
                        "title": title,
                        "status": "failed",
                        "duration": f"{duration}ms",
                        "error": {"message": error_msg}
                    })
        
        passed = len([t for t in test_results if t["status"] == "passed"])
        failed = len([t for t in test_results if t["status"] == "failed"])
        
        return {
            "success": return_code == 0 and failed == 0,
            "testResults": test_results,
            "duration": "unknown",
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed
            }
        }
    
    def _parse_jest_results(self, results: Dict) -> Dict[str, Any]:
        """Parse Jest JSON results."""
        test_results = []
        total_duration = 0
        
        for test_suite in results.get("testResults", []):
            for assertion in test_suite.get("assertionResults", []):
                title = assertion.get("title", "Unknown")
                status = "passed" if assertion.get("status") == "passed" else "failed"
                duration = assertion.get("duration", 0)
                total_duration += duration
                
                tc_match = re.search(r'(TC-\d+)', title)
                test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                
                error_msg = None
                if status == "failed":
                    failure_messages = assertion.get("failureMessages", [])
                    if failure_messages:
                        error_msg = failure_messages[0]
                
                test_results.append({
                    "id": test_id,
                    "name": title,
                    "title": title,
                    "status": status,
                    "duration": f"{duration}ms",
                    "error": {"message": error_msg} if error_msg else None
                })
        
        passed = len([t for t in test_results if t["status"] == "passed"])
        failed = len([t for t in test_results if t["status"] == "failed"])
        
        return {
            "success": results.get("success", False),
            "testResults": test_results,
            "duration": f"{total_duration}ms",
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed
            }
        }
    
    def _parse_jest_console(self, stdout: str, stderr: str, return_code: int) -> Dict[str, Any]:
        """Parse Jest console output when JSON parsing fails."""
        test_results = []
        output = stdout + stderr
        
        lines = output.split('\n')
        for line in lines:
            if '✓' in line or '✔' in line or 'PASS' in line:
                match = re.search(r'✓\s+(.+?)(?:\s+\((\d+)\s*ms\))?', line)
                if match:
                    title = match.group(1).strip()
                    duration = match.group(2) if match.group(2) else "0"
                    tc_match = re.search(r'(TC-\d+)', title)
                    test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                    
                    test_results.append({
                        "id": test_id,
                        "name": title,
                        "status": "passed",
                        "duration": f"{duration}ms",
                        "error": None
                    })
            elif '✘' in line or '✗' in line or 'FAIL' in line:
                match = re.search(r'[✘✗]\s+(.+)', line)
                if match:
                    title = match.group(1).strip()
                    tc_match = re.search(r'(TC-\d+)', title)
                    test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                    
                    test_results.append({
                        "id": test_id,
                        "name": title,
                        "status": "failed",
                        "duration": "0ms",
                        "error": {"message": "Test failed"}
                    })
        
        passed = len([t for t in test_results if t["status"] == "passed"])
        failed = len([t for t in test_results if t["status"] == "failed"])
        
        return {
            "success": return_code == 0,
            "testResults": test_results,
            "duration": "unknown",
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed
            }
        }
    
    def _parse_pytest_output(self, result: subprocess.CompletedProcess) -> Dict[str, Any]:
        """Parse pytest output."""
        test_results = []
        output = result.stdout + result.stderr
        
        for match in re.finditer(r'(test_\w+)\s+PASSED', output):
            test_results.append({
                "id": f"TC-{len(test_results)+1:03d}",
                "name": match.group(1),
                "status": "passed",
                "duration": "unknown"
            })
        
        for match in re.finditer(r'(test_\w+)\s+FAILED', output):
            test_results.append({
                "id": f"TC-{len(test_results)+1:03d}",
                "name": match.group(1),
                "status": "failed",
                "duration": "unknown",
                "error": {"message": "Test failed"}
            })
        
        passed = len([t for t in test_results if t["status"] == "passed"])
        failed = len([t for t in test_results if t["status"] == "failed"])
        
        return {
            "success": result.returncode == 0,
            "testResults": test_results,
            "duration": "unknown",
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed
            }
        }
    
    def _parse_console_output(self, stdout: str, stderr: str, return_code: int) -> Dict[str, Any]:
        """Parse Playwright console output when JSON is not available."""
        test_results = []
        output = stdout + stderr
        
        lines = output.split('\n')
        for line in lines:
            if '✓' in line or '✔' in line:
                match = re.search(r'›\s*([^›]+?)\s*\((\d+)(?:ms|s)\)', line)
                if match:
                    title = match.group(1).strip()
                    duration = match.group(2)
                    tc_match = re.search(r'(TC-\d+)', title)
                    test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                    
                    test_results.append({
                        "id": test_id,
                        "name": title,
                        "title": title,
                        "status": "passed",
                        "duration": f"{duration}ms",
                        "error": None
                    })
            elif '✘' in line or '✗' in line or '×' in line:
                match = re.search(r'›\s*([^›]+?)\s*(?:\((\d+)(?:ms|s)\))?', line)
                if match:
                    title = match.group(1).strip()
                    duration = match.group(2) if match.group(2) else "0"
                    tc_match = re.search(r'(TC-\d+)', title)
                    test_id = tc_match.group(1) if tc_match else f"TC-{len(test_results)+1:03d}"
                    
                    test_results.append({
                        "id": test_id,
                        "name": title,
                        "title": title,
                        "status": "failed",
                        "duration": f"{duration}ms",
                        "error": {"message": "Test failed - see console output"}
                    })
        
        passed = len([t for t in test_results if t["status"] == "passed"])
        failed = len([t for t in test_results if t["status"] == "failed"])
        
        return {
            "success": return_code == 0 and failed == 0,
            "testResults": test_results,
            "duration": "unknown",
            "summary": {
                "total": len(test_results),
                "passed": passed,
                "failed": failed
            },
            "consoleOutput": output[:3000]
        }
