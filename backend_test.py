#!/usr/bin/env python3
"""
ERRORHACKER Backend API Test Suite
Tests all endpoints as specified in the review request.
"""
import requests
import json
import re
import sys

# Backend URL from frontend/.env
BASE_URL = "https://functionality-139.preview.emergentagent.com/api"

# Test state
test_results = []
admin_token = None
order_id = None

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results.append({"name": name, "passed": passed, "details": details})
    print(f"{status} | {name}")
    if details:
        print(f"    {details}")

def test_health_check():
    """Test 1: GET /api/ - health check"""
    try:
        resp = requests.get(f"{BASE_URL}/", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("service") == "ERRORHACKER API" and data.get("status") == "online":
                log_test("GET /api/ - Health check", True, f"Response: {data}")
                return True
            else:
                log_test("GET /api/ - Health check", False, f"Unexpected response: {data}")
                return False
        else:
            log_test("GET /api/ - Health check", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("GET /api/ - Health check", False, f"Exception: {str(e)}")
        return False

def test_get_config():
    """Test 2: GET /api/config - public endpoint"""
    try:
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["site", "nav", "hero", "services", "books", "memberships", 
                           "blogs", "tools", "partners", "faqs", "testimonials", 
                           "activity", "stats", "howSteps", "comparison"]
            missing_keys = [k for k in required_keys if k not in data]
            
            if missing_keys:
                log_test("GET /api/config - Public", False, f"Missing keys: {missing_keys}")
                return False
            
            # Check site.name
            if data.get("site", {}).get("name") != "ERRORHACKER":
                log_test("GET /api/config - Public", False, f"site.name is '{data.get('site', {}).get('name')}', expected 'ERRORHACKER'")
                return False
            
            # Check non-empty arrays
            if not data.get("services") or not data.get("books") or not data.get("memberships"):
                log_test("GET /api/config - Public", False, "services/books/memberships should be non-empty")
                return False
            
            log_test("GET /api/config - Public", True, f"All required keys present, site.name=ERRORHACKER")
            return True
        else:
            log_test("GET /api/config - Public", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("GET /api/config - Public", False, f"Exception: {str(e)}")
        return False

def test_admin_login_correct():
    """Test 3a: POST /api/admin/login - correct password"""
    global admin_token
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/login",
            json={"password": "admin123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok") and data.get("token"):
                # Verify token is a valid hex string (uuid4.hex)
                token = data.get("token")
                if re.match(r'^[a-f0-9]{32}$', token):
                    admin_token = token
                    log_test("POST /api/admin/login - Correct password", True, f"Token received: {token[:8]}...")
                    return True
                else:
                    log_test("POST /api/admin/login - Correct password", False, f"Token format invalid: {token}")
                    return False
            else:
                log_test("POST /api/admin/login - Correct password", False, f"Missing ok/token in response: {data}")
                return False
        else:
            log_test("POST /api/admin/login - Correct password", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("POST /api/admin/login - Correct password", False, f"Exception: {str(e)}")
        return False

def test_admin_login_wrong():
    """Test 3b: POST /api/admin/login - wrong password"""
    try:
        resp = requests.post(
            f"{BASE_URL}/admin/login",
            json={"password": "wrong"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if resp.status_code == 401:
            data = resp.json()
            if "Access denied" in data.get("detail", ""):
                log_test("POST /api/admin/login - Wrong password", True, "Correctly returned 401 with 'Access denied'")
                return True
            else:
                log_test("POST /api/admin/login - Wrong password", False, f"401 but wrong detail: {data}")
                return False
        else:
            log_test("POST /api/admin/login - Wrong password", False, f"Expected 401, got {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("POST /api/admin/login - Wrong password", False, f"Exception: {str(e)}")
        return False

def test_admin_endpoints_without_token():
    """Test 4: Admin-protected endpoints without token should return 401"""
    endpoints = [
        ("PUT", "/config", {"site": {"name": "test"}}),
        ("PATCH", "/config", {"site": {"name": "test"}}),
        ("GET", "/orders", None),
        ("DELETE", "/orders", None),
        ("POST", "/admin/password", {"new_password": "test"}),
    ]
    
    all_passed = True
    for method, path, body in endpoints:
        try:
            url = f"{BASE_URL}{path}"
            if method == "GET":
                resp = requests.get(url, timeout=10)
            elif method == "PUT":
                resp = requests.put(url, json=body, headers={"Content-Type": "application/json"}, timeout=10)
            elif method == "PATCH":
                resp = requests.patch(url, json=body, headers={"Content-Type": "application/json"}, timeout=10)
            elif method == "POST":
                resp = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=10)
            elif method == "DELETE":
                resp = requests.delete(url, timeout=10)
            
            if resp.status_code == 401:
                print(f"    ✓ {method} {path} correctly returned 401")
            else:
                print(f"    ✗ {method} {path} returned {resp.status_code} instead of 401")
                all_passed = False
        except Exception as e:
            print(f"    ✗ {method} {path} exception: {str(e)}")
            all_passed = False
    
    log_test("Admin endpoints without token return 401", all_passed)
    return all_passed

def test_put_config():
    """Test 5: PUT /api/config with token - replace config"""
    if not admin_token:
        log_test("PUT /api/config - Replace config", False, "No admin token available")
        return False
    
    try:
        # First get current config
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        if resp.status_code != 200:
            log_test("PUT /api/config - Replace config", False, "Failed to get current config")
            return False
        
        original_config = resp.json()
        
        # Modify site.name
        modified_config = original_config.copy()
        modified_config["site"]["name"] = "ERRORHACKER-TEST"
        
        # PUT the modified config
        resp = requests.put(
            f"{BASE_URL}/config",
            json=modified_config,
            headers={"Content-Type": "application/json", "X-Admin-Token": admin_token},
            timeout=10
        )
        
        if resp.status_code != 200:
            log_test("PUT /api/config - Replace config", False, f"PUT failed with status {resp.status_code}: {resp.text}")
            return False
        
        # Verify the change
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("site", {}).get("name") == "ERRORHACKER-TEST":
                # Restore original
                resp = requests.put(
                    f"{BASE_URL}/config",
                    json=original_config,
                    headers={"Content-Type": "application/json", "X-Admin-Token": admin_token},
                    timeout=10
                )
                if resp.status_code == 200:
                    log_test("PUT /api/config - Replace config", True, "Successfully changed and restored site.name")
                    return True
                else:
                    log_test("PUT /api/config - Replace config", False, f"Failed to restore config: {resp.status_code}")
                    return False
            else:
                log_test("PUT /api/config - Replace config", False, f"site.name not updated: {data.get('site', {}).get('name')}")
                return False
        else:
            log_test("PUT /api/config - Replace config", False, f"Failed to verify change: {resp.status_code}")
            return False
    except Exception as e:
        log_test("PUT /api/config - Replace config", False, f"Exception: {str(e)}")
        return False

def test_patch_config():
    """Test 6: PATCH /api/config with token - partial update"""
    if not admin_token:
        log_test("PATCH /api/config - Partial update", False, "No admin token available")
        return False
    
    try:
        # Get current config
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        if resp.status_code != 200:
            log_test("PATCH /api/config - Partial update", False, "Failed to get current config")
            return False
        
        original_config = resp.json()
        original_version = original_config.get("site", {}).get("version", "")
        
        # PATCH with partial update (note: this replaces the site sub-doc)
        resp = requests.patch(
            f"{BASE_URL}/config",
            json={"site": {"version": "v9.9.9-test"}},
            headers={"Content-Type": "application/json", "X-Admin-Token": admin_token},
            timeout=10
        )
        
        if resp.status_code != 200:
            log_test("PATCH /api/config - Partial update", False, f"PATCH failed with status {resp.status_code}: {resp.text}")
            return False
        
        # Verify the change
        resp = requests.get(f"{BASE_URL}/config", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("site", {}).get("version") == "v9.9.9-test":
                # Restore original site object
                resp = requests.patch(
                    f"{BASE_URL}/config",
                    json={"site": original_config["site"]},
                    headers={"Content-Type": "application/json", "X-Admin-Token": admin_token},
                    timeout=10
                )
                if resp.status_code == 200:
                    log_test("PATCH /api/config - Partial update", True, "Successfully patched and restored site.version")
                    return True
                else:
                    log_test("PATCH /api/config - Partial update", False, f"Failed to restore: {resp.status_code}")
                    return False
            else:
                log_test("PATCH /api/config - Partial update", False, f"site.version not updated: {data.get('site', {}).get('version')}")
                return False
        else:
            log_test("PATCH /api/config - Partial update", False, f"Failed to verify change: {resp.status_code}")
            return False
    except Exception as e:
        log_test("PATCH /api/config - Partial update", False, f"Exception: {str(e)}")
        return False

def test_create_order():
    """Test 7: POST /api/orders - public endpoint"""
    global order_id
    try:
        order_data = {
            "service": "yt-subs",
            "serviceName": "YouTube Subscribers - Test",
            "name": "Test User",
            "email": "test@example.com",
            "tg": "@test",
            "size": "1000",
            "target": "https://test",
            "notes": "please test"
        }
        
        resp = requests.post(
            f"{BASE_URL}/orders",
            json=order_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            # Verify id format: ORD-[A-F0-9]{10}
            order_id = data.get("id")
            if not order_id or not re.match(r'^ORD-[A-F0-9]{10}$', order_id):
                log_test("POST /api/orders - Create order", False, f"Invalid order ID format: {order_id}")
                return False
            
            # Verify status and createdAt
            if data.get("status") != "received":
                log_test("POST /api/orders - Create order", False, f"Status is '{data.get('status')}', expected 'received'")
                return False
            
            if not data.get("createdAt"):
                log_test("POST /api/orders - Create order", False, "Missing createdAt field")
                return False
            
            log_test("POST /api/orders - Create order", True, f"Order created: {order_id}")
            return True
        else:
            log_test("POST /api/orders - Create order", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("POST /api/orders - Create order", False, f"Exception: {str(e)}")
        return False

def test_get_order_by_id():
    """Test 8: GET /api/orders/{id} - public endpoint"""
    if not order_id:
        log_test("GET /api/orders/{id} - Get order", False, "No order_id available")
        return False
    
    try:
        # Test with valid ID
        resp = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("id") == order_id:
                log_test("GET /api/orders/{id} - Valid ID", True, f"Order retrieved: {order_id}")
            else:
                log_test("GET /api/orders/{id} - Valid ID", False, f"Order ID mismatch: {data.get('id')}")
                return False
        else:
            log_test("GET /api/orders/{id} - Valid ID", False, f"Status {resp.status_code}: {resp.text}")
            return False
        
        # Test with invalid ID
        resp = requests.get(f"{BASE_URL}/orders/INVALID-ID", timeout=10)
        if resp.status_code == 404:
            log_test("GET /api/orders/{id} - Invalid ID", True, "Correctly returned 404")
            return True
        else:
            log_test("GET /api/orders/{id} - Invalid ID", False, f"Expected 404, got {resp.status_code}")
            return False
    except Exception as e:
        log_test("GET /api/orders/{id} - Get order", False, f"Exception: {str(e)}")
        return False

def test_list_orders_admin():
    """Test 9: GET /api/orders - admin only"""
    if not admin_token:
        log_test("GET /api/orders - List orders (admin)", False, "No admin token available")
        return False
    
    try:
        # Test with token
        resp = requests.get(
            f"{BASE_URL}/orders",
            headers={"X-Admin-Token": admin_token},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                # Check if our order is in the list
                found = any(o.get("id") == order_id for o in data)
                if found:
                    log_test("GET /api/orders - List orders (admin)", True, f"Found {len(data)} orders including our test order")
                    return True
                else:
                    log_test("GET /api/orders - List orders (admin)", False, f"Our order {order_id} not found in list")
                    return False
            else:
                log_test("GET /api/orders - List orders (admin)", False, f"Expected list, got {type(data)}")
                return False
        else:
            log_test("GET /api/orders - List orders (admin)", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("GET /api/orders - List orders (admin)", False, f"Exception: {str(e)}")
        return False

def test_update_order():
    """Test 10: PATCH /api/orders/{id} - admin only"""
    if not admin_token or not order_id:
        log_test("PATCH /api/orders/{id} - Update order", False, "Missing admin token or order_id")
        return False
    
    try:
        # Update order status
        resp = requests.patch(
            f"{BASE_URL}/orders/{order_id}",
            json={"status": "in-progress"},
            headers={"Content-Type": "application/json", "X-Admin-Token": admin_token},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "in-progress":
                # Verify with GET
                resp = requests.get(f"{BASE_URL}/orders/{order_id}", timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "in-progress":
                        log_test("PATCH /api/orders/{id} - Update order", True, "Status updated to 'in-progress'")
                        return True
                    else:
                        log_test("PATCH /api/orders/{id} - Update order", False, f"GET shows status '{data.get('status')}', expected 'in-progress'")
                        return False
                else:
                    log_test("PATCH /api/orders/{id} - Update order", False, f"GET failed: {resp.status_code}")
                    return False
            else:
                log_test("PATCH /api/orders/{id} - Update order", False, f"Status is '{data.get('status')}', expected 'in-progress'")
                return False
        else:
            log_test("PATCH /api/orders/{id} - Update order", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("PATCH /api/orders/{id} - Update order", False, f"Exception: {str(e)}")
        return False

def test_delete_orders():
    """Test 11: DELETE /api/orders - admin only"""
    if not admin_token:
        log_test("DELETE /api/orders - Clear orders", False, "No admin token available")
        return False
    
    try:
        # Delete all orders
        resp = requests.delete(
            f"{BASE_URL}/orders",
            headers={"X-Admin-Token": admin_token},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if "deleted" in data and isinstance(data["deleted"], int):
                # Verify orders are cleared
                resp = requests.get(
                    f"{BASE_URL}/orders",
                    headers={"X-Admin-Token": admin_token},
                    timeout=10
                )
                if resp.status_code == 200:
                    orders = resp.json()
                    if len(orders) == 0:
                        log_test("DELETE /api/orders - Clear orders", True, f"Deleted {data['deleted']} orders, list now empty")
                        return True
                    else:
                        log_test("DELETE /api/orders - Clear orders", False, f"Orders list not empty: {len(orders)} orders remain")
                        return False
                else:
                    log_test("DELETE /api/orders - Clear orders", False, f"GET failed: {resp.status_code}")
                    return False
            else:
                log_test("DELETE /api/orders - Clear orders", False, f"Invalid response: {data}")
                return False
        else:
            log_test("DELETE /api/orders - Clear orders", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("DELETE /api/orders - Clear orders", False, f"Exception: {str(e)}")
        return False

def test_change_password():
    """Test 12: POST /api/admin/password - change password and invalidate tokens"""
    global admin_token
    if not admin_token:
        log_test("POST /api/admin/password - Change password", False, "No admin token available")
        return False
    
    old_token = admin_token
    
    try:
        # Change password
        resp = requests.post(
            f"{BASE_URL}/admin/password",
            json={"new_password": "newpass123"},
            headers={"Content-Type": "application/json", "X-Admin-Token": old_token},
            timeout=10
        )
        
        if resp.status_code != 200:
            log_test("POST /api/admin/password - Change password", False, f"Password change failed: {resp.status_code}: {resp.text}")
            return False
        
        data = resp.json()
        if not data.get("ok"):
            log_test("POST /api/admin/password - Change password", False, f"Response not ok: {data}")
            return False
        
        # Verify old token is invalidated
        resp = requests.get(
            f"{BASE_URL}/orders",
            headers={"X-Admin-Token": old_token},
            timeout=10
        )
        if resp.status_code != 401:
            log_test("POST /api/admin/password - Change password", False, f"Old token still valid (expected 401, got {resp.status_code})")
            return False
        
        # Verify old password doesn't work
        resp = requests.post(
            f"{BASE_URL}/admin/login",
            json={"password": "admin123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if resp.status_code != 401:
            log_test("POST /api/admin/password - Change password", False, f"Old password still works (expected 401, got {resp.status_code})")
            return False
        
        # Login with new password
        resp = requests.post(
            f"{BASE_URL}/admin/login",
            json={"password": "newpass123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if resp.status_code != 200:
            log_test("POST /api/admin/password - Change password", False, f"New password login failed: {resp.status_code}")
            return False
        
        new_token = resp.json().get("token")
        if not new_token:
            log_test("POST /api/admin/password - Change password", False, "No token in new login response")
            return False
        
        # Restore original password
        resp = requests.post(
            f"{BASE_URL}/admin/password",
            json={"new_password": "admin123"},
            headers={"Content-Type": "application/json", "X-Admin-Token": new_token},
            timeout=10
        )
        if resp.status_code != 200:
            log_test("POST /api/admin/password - Change password", False, f"Failed to restore password: {resp.status_code}")
            return False
        
        # Update admin_token for any subsequent tests
        resp = requests.post(
            f"{BASE_URL}/admin/login",
            json={"password": "admin123"},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        if resp.status_code == 200:
            admin_token = resp.json().get("token")
        
        log_test("POST /api/admin/password - Change password", True, "Password changed, old token invalidated, password restored")
        return True
    except Exception as e:
        log_test("POST /api/admin/password - Change password", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("ERRORHACKER Backend API Test Suite")
    print(f"Testing: {BASE_URL}")
    print("=" * 80)
    print()
    
    # Run tests in order
    test_health_check()
    test_get_config()
    test_admin_login_correct()
    test_admin_login_wrong()
    test_admin_endpoints_without_token()
    test_put_config()
    test_patch_config()
    test_create_order()
    test_get_order_by_id()
    test_list_orders_admin()
    test_update_order()
    test_delete_orders()
    test_change_password()
    
    # Summary
    print()
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    passed = sum(1 for t in test_results if t["passed"])
    total = len(test_results)
    print(f"Passed: {passed}/{total}")
    print()
    
    if passed < total:
        print("FAILED TESTS:")
        for t in test_results:
            if not t["passed"]:
                print(f"  ❌ {t['name']}")
                if t["details"]:
                    print(f"     {t['details']}")
        print()
        sys.exit(1)
    else:
        print("✅ ALL TESTS PASSED!")
        sys.exit(0)

if __name__ == "__main__":
    main()
