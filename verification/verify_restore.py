from playwright.sync_api import Page, expect, sync_playwright

def verify_full_analysis(page: Page):
    # Mock the backend response
    def handle_analyze(route):
        route.fulfill(
            status=200,
            content_type="application/json",
            body='''{
                "ok": true,
                "data": {
                    "verdict": "BENIGN",
                    "riskScore": 10,
                    "confidence": 0.95,
                    "summary": "Verified safe by logic.",
                    "explanation": { "summary": "Safe" },
                    "analyst_insight": { "guidance": "No action needed.", "analyst_recommendation": "Proceed" },
                    "signals": ["HTTPS Valid"],
                    "confidence_range": { "min": 90, "max": 100 },
                    "epistemic_profile": { "uncertainty_sources": [] },
                    "why_it_matters": ["Domain is trusted"]
                }
            }'''
        )

    # Intercept network
    page.route("**/analyze", handle_analyze)

    # 1. Navigate
    print("Navigating...")
    page.goto("http://localhost:3000")

    # 2. Click Start
    print("Starting...")
    page.get_by_role("button", name="Start Analyzing").first.click()

    # 3. Enter URL
    print("Entering URL...")
    page.get_by_placeholder("// Paste URL, IP, or Text...").fill("google.com")

    # 4. Run
    print("Running...")
    page.get_by_role("button", name="Run Analysis").click()

    # 5. Verify Success State
    print("Verifying...")
    # Based on Screenshot: Title "Safe", Summary "No action needed."
    expect(page.get_by_text("Safe", exact=True)).to_be_visible(timeout=15000)
    expect(page.get_by_text("No action needed.")).to_be_visible()

    # 6. Screenshot
    print("Screenshot...")
    page.screenshot(path="verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 800})
        try:
            verify_full_analysis(page)
            print("Verification Passed")
        except Exception as e:
            print(f"Verification Failed: {e}")
            page.screenshot(path="error.png")
            raise e
        finally:
            browser.close()
