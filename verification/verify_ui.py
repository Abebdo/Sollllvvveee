from playwright.sync_api import Page, expect, sync_playwright

def verify_analysis_stub(page: Page):
    # 1. Navigate to home
    print("Navigating to home...")
    page.goto("http://localhost:3000")

    # 2. Start Analyzing
    print("Clicking Start Analyzing...")
    page.get_by_role("button", name="Start Analyzing").first.click()

    # 3. Enter URL
    print("Entering URL...")
    textarea = page.get_by_placeholder("// Paste URL, IP, or Text...")
    textarea.fill("google.com")

    # 4. Click Run Analysis
    print("Clicking Run Analysis...")
    run_btn = page.get_by_role("button", name="Run Analysis")
    run_btn.click()

    # 5. Wait for completion (fallback is "System Recovering")
    print("Waiting for result...")
    expect(page.get_by_text("System Recovering")).to_be_visible(timeout=15000)

    # 6. Verify content
    expect(page.get_by_text("The analysis engine is currently initializing")).to_be_visible()

    # 7. Screenshot
    print("Taking screenshot...")
    # Scroll to top to ensure result is visible
    page.mouse.wheel(0, -1000)
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        try:
            verify_analysis_stub(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
            raise e
        finally:
            browser.close()
