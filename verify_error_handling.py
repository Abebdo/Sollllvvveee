from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Intercept the analysis request and fail it with 503
    def handle_route(route):
        if "/analyze" in route.request.url:
            print(f"Intercepting request to {route.request.url}")
            route.fulfill(status=503, body='{"error": "Service Unavailable"}', content_type="application/json")
        else:
            route.continue_()

    page.route("**/*", handle_route)

    try:
        # Go to the app
        print("Navigating to app...")
        page.goto("http://localhost:3000")

        # Wait for animations to settle
        print("Waiting for animations...")
        page.wait_for_timeout(3000)

        # Wait for the input field
        print("Looking for input...")
        input_area = page.get_by_placeholder("// Paste URL, IP, or Text...")

        # Ensure it's visible
        expect(input_area).to_be_visible()

        print("Filling input...")
        input_area.fill("example.com")

        # Click analyze button
        # The button has text "Run Analysis"
        print("Clicking analyze...")
        analyze_btn = page.get_by_role("button", name="Run Analysis")
        analyze_btn.click()

        # Wait for the error message
        # "Analysis Unreachable (Service Unavailable (503))" should appear in the UI.
        print("Waiting for error message...")
        expect(page.get_by_text("Analysis Unreachable (Service Unavailable (503))")).to_be_visible(timeout=15000)

        # Take screenshot
        page.screenshot(path="/home/jules/verification/error_handling.png")
        print("Verification successful: Error message displayed.")

    except Exception as e:
        print(f"Test failed: {e}")
        page.screenshot(path="/home/jules/verification/error_failure.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
