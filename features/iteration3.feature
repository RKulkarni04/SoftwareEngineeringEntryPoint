# features/entrypoint_features.feature
# Integration tests: UC-4 Weather, UC-5 Subject matter, UC-6 PDF upload, UC-7 Mastery tracking
#
# Run: npx cucumber-js features/iteration3.feature

Feature: EntryPoint Core Learning Features
  As a student using EntryPoint
  I want access to weather context, subject tailoring, file uploads, and mastery tracking
  So that I can get the most relevant AI responses and track my learning progress

  Background:
    Given I am logged in as a valid user
    And I have an active chat session

  # ── UC-4: Weather data ────────────────────────────────────────────────────────

  Scenario: Weather context toggle button is visible in the sidebar
    When I navigate to the chat page
    Then I should see a "Weather context" toggle button in the sidebar

  Scenario: Clicking the weather toggle requests geolocation
    When I navigate to the chat page
    And I click the "Weather context" toggle button
    Then the browser should have requested geolocation permission

  Scenario: Weather banner appears after granting location permission
    When I navigate to the chat page
    And geolocation is mocked to return coordinates "51.5" "−0.1"
    And the weather API returns a clear sky response
    And I click the "Weather context" toggle button
    Then the weather banner should become visible
    And the weather banner should display a temperature value
    And the weather banner should display a weather description

  Scenario: Weather badge in the banner confirms context is active
    When I navigate to the chat page
    And I activate weather context
    Then the weather banner should contain the text "Weather context active"

  Scenario: Dismissing the weather banner deactivates weather context
    When I navigate to the chat page
    And I activate weather context
    And I click the dismiss button on the weather banner
    Then the weather banner should not be visible
    And the weather toggle button should not be in its active state

  Scenario: Weather toggle button shows an active state indicator when on
    When I navigate to the chat page
    And I activate weather context
    Then the weather toggle button should have the "active" CSS class

  # ── UC-5: Subject matter selection ───────────────────────────────────────────

  Scenario: All six subject buttons are present in the sidebar
    When I navigate to the chat page
    Then I should see the subject button "General"
    And I should see the subject button "Mathematics"
    And I should see the subject button "Science"
    And I should see the subject button "History"
    And I should see the subject button "Literature"
    And I should see the subject button "Computing"

  Scenario: "General" is the default active subject
    When I navigate to the chat page
    Then the "General" subject button should have the "active" CSS class

  Scenario: Clicking a subject button makes it active and deactivates others
    When I navigate to the chat page
    And I click the "Mathematics" subject button
    Then the "Mathematics" subject button should have the "active" CSS class
    And the "General" subject button should not have the "active" CSS class

  Scenario: The input hint updates to reflect the chosen subject
    When I navigate to the chat page
    And I click the "Science" subject button
    Then the input hint area should mention "Science"

  Scenario: Selecting Computing subject works correctly
    When I navigate to the chat page
    And I click the "Computing" subject button
    Then the "Computing" subject button should have the "active" CSS class

  # ── UC-6: PDF upload ──────────────────────────────────────────────────────────

  Scenario: Attach button is visible in the input row
    When I navigate to the chat page
    Then I should see an attach button (📎) in the input area

  Scenario: Selecting a text file shows a file preview strip
    When I navigate to the chat page
    And I attach a file named "notes.txt" of type "text/plain"
    Then the file preview strip should become visible
    And the file preview should display the filename "notes.txt"

  Scenario: Selecting a PDF file shows the correct icon in the preview
    When I navigate to the chat page
    And I attach a file named "essay.pdf" of type "application/pdf"
    Then the file preview strip should become visible
    And the attach button should have the "has-file" CSS class

  Scenario: Removing the attached file hides the preview strip
    When I navigate to the chat page
    And I attach a file named "data.csv" of type "text/csv"
    And I click the remove button on the file preview
    Then the file preview strip should not be visible
    And the attach button should not have the "has-file" CSS class

  Scenario: File size is displayed in the preview strip
    When I navigate to the chat page
    And I attach a file named "report.pdf" of type "application/pdf" with size 204800
    Then the file preview should display a file size indicator

  Scenario: Sending a message with an attached file includes the filename in the user bubble
    When I navigate to the chat page
    And I attach a file named "chapter1.txt" of type "text/plain"
    And I type "Summarise this" in the chat input
    And I click the send button
    Then the user message bubble should contain "chapter1.txt"

  # ── UC-7: Mastery tracking ────────────────────────────────────────────────────

  Scenario: Mastery page is accessible from the chat navigation
    When I navigate to the chat page
    Then I should see a "Mastery" link in the top navigation

  Scenario: Navigating to the mastery page shows a list of chat sessions
    When I navigate to the mastery page
    Then I should see the mastery page heading
    And I should see at least one mastery row with a progress bar

  Scenario: Each mastery row displays a session title and a score
    When I navigate to the mastery page
    Then each mastery row should have a title label
    And each mastery row should have a numeric score or a "—" placeholder

  Scenario: Mastery scores are represented as progress bars
    When I navigate to the mastery page
    Then I should see bar-fill elements in the mastery rows

  Scenario: The sidebar mastery strip updates after a chat exchange
    When I navigate to the chat page
    And I send a message "Explain gravity"
    And the AI responds with a mastery score of 55
    Then the mastery bar in the sidebar should reflect a non-zero width

  Scenario: Mastery page redirects unauthenticated users to the landing page
    Given I am not logged in
    When I navigate directly to the mastery page
    Then I should be redirected to the landing page

  Scenario: The mastery page shows an empty state when no sessions exist
    Given I am logged in as a new user with no chat history
    When I navigate to the mastery page
    Then I should see a message indicating no sessions are available
