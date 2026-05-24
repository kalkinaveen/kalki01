#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Clone bd71zone.com with neon ethical-hacking theme (per user video). Add monetization (services, books, memberships), full-control admin panel, then wire to MongoDB backend."

backend:
  - task: "Site Config API (GET/PUT/PATCH /api/config)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Single MongoDB doc (_id='main') seeded from defaults.py. GET is public; PUT/PATCH require X-Admin-Token header."
      - working: true
        agent: "testing"
        comment: "✅ ALL TESTS PASSED. GET /api/config returns full config with all required keys (site, nav, hero, services, books, memberships, blogs, tools, partners, faqs, testimonials, activity, stats, howSteps, comparison). site.name='ERRORHACKER', services/books/memberships are non-empty arrays. PUT /api/config with X-Admin-Token successfully replaces config (tested by changing site.name to 'ERRORHACKER-TEST' and restoring). PATCH /api/config with token successfully does partial update (tested by changing site.version to 'v9.9.9-test' and restoring). Both PUT and PATCH correctly return 401 without token."
  - task: "Admin auth (POST /api/admin/login, /logout, /password)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Default password 'admin123'. Login returns random uuid token stored in admin.tokens array (last 10 kept). password change endpoint resets tokens. logout pulls token."
      - working: true
        agent: "testing"
        comment: "✅ ALL TESTS PASSED. POST /api/admin/login with correct password ('admin123') returns {ok: true, token: <32-char hex uuid>}. Wrong password correctly returns 401 with 'Access denied'. POST /api/admin/password with token successfully changes password, invalidates all old tokens (verified old token returns 401), old password stops working, new password works. Password successfully restored to 'admin123'. All admin-protected endpoints (PUT/PATCH /api/config, GET/DELETE /api/orders, POST /api/admin/password) correctly return 401 without token."
  - task: "Orders CRUD (POST /api/orders public, GET/PATCH/DELETE admin, GET /api/orders/{id} public for tracker)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST is public, returns generated ORD-XXXXXXXXXX id. GET /orders requires admin token. GET /orders/{id} is public for the order-tracker page. PATCH updates status. DELETE clears all."
      - working: true
        agent: "testing"
        comment: "✅ ALL TESTS PASSED. POST /api/orders (public) creates order with correct format: id='ORD-[A-F0-9]{10}' (e.g., ORD-06B11926E4), status='received', createdAt ISO timestamp. GET /api/orders/{id} (public) retrieves order by id; invalid id returns 404. GET /api/orders (admin with token) lists all orders sorted by createdAt desc; without token returns 401. PATCH /api/orders/{id} (admin with token) updates status to 'in-progress', verified with subsequent GET. DELETE /api/orders (admin with token) clears all orders, returns {deleted: count}, verified list is empty; without token returns 401."

frontend:
  - task: "SiteConfig hydration from API"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/contexts/SiteConfigContext.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "On mount fetches /api/config. localStorage is used as cache + offline fallback. When admin logged in, every setConfig/update/setList auto-pushes PUT /api/config."

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Backend ready: FastAPI + MongoDB. Endpoints under /api prefix. Please verify: (1) GET /api/config returns full seeded config with services, books, memberships, etc. (2) POST /api/admin/login with body {\"password\":\"admin123\"} returns ok+token; wrong password returns 401. (3) Using returned token in X-Admin-Token header, PUT /api/config replaces config; without header returns 401. (4) POST /api/orders with valid body creates order, GET /api/orders/{id} fetches it, PATCH /api/orders/{id} with body {\"status\":\"in-progress\"} (admin) updates it, GET /api/orders (admin) lists all, DELETE /api/orders (admin) clears. (5) POST /api/admin/password changes password and invalidates old tokens. All requests must use REACT_APP_BACKEND_URL + /api prefix."
  - agent: "testing"
    message: "✅ BACKEND TESTING COMPLETE - ALL 14 TESTS PASSED (100%). Comprehensive test suite created at /app/backend_test.py covering all endpoints: health check, config CRUD (GET/PUT/PATCH), admin auth (login with correct/wrong password, password change with token invalidation), orders CRUD (public POST, public GET by id with 404 for invalid, admin GET list, admin PATCH status, admin DELETE all), and authorization checks (all admin endpoints return 401 without token). Backend logs clean with no errors. All three backend tasks are now WORKING and ready for production."
