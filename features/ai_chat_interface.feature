# features/ai_chat_interface.feature
#
# User Story 2: AI Chat Interface
# "As a user, I want to send messages to an LLM, receive replies,
#  and view my chat history so I can use the AI assistant flawlessly."

Feature: AI Chat Interface
  As an authenticated user
  I want to chat with an AI model and access my past conversations
  So that I can get help and refer back to previous answers

  Background:
    Given I am logged in as "testuser@rutgers.edu" with password "Password123"
    And I am on the chat page

  # ── Sending messages ────────────────────────────────────────────────────

  Scenario: Send a message and receive a reply
    When I type "What is the capital of France?" into the chat input
    And I click the "Send" button
    Then I should see my message "What is the capital of France?" in the chat window
    And I should see an AI reply appear below my message

  Scenario: The reply is not empty
    When I type "Tell me a joke" into the chat input
    And I click the "Send" button
    Then the AI reply should contain at least one character

  Scenario: Send button is disabled while waiting for a reply
    When I type "Long question" into the chat input
    And I click the "Send" button
    Then the "Send" button should be disabled
    And once the reply arrives the "Send" button should be enabled again

  Scenario: Cannot send an empty message
    When I leave the chat input blank
    And I click the "Send" button
    Then I should see the error "Please enter a message"
    And no new message should appear in the chat window

  Scenario: AI is unreachable — user sees a friendly error
    Given the AI model service is offline
    When I type "Hello" into the chat input
    And I click the "Send" button
    Then I should see the message "AI model error. Make sure Ollama is running."

  # ── Viewing history ─────────────────────────────────────────────────────

  Scenario: Previous conversations appear in the sidebar
    Given I have previously sent the message "Explain recursion"
    When I open the chat page
    Then I should see "Explain recursion" listed in the conversation sidebar

  Scenario: Sidebar shows at most the 5 most recent conversations
    Given I have previously sent 7 different messages
    When I open the chat page
    Then the conversation sidebar should show exactly 5 entries

  Scenario: Clicking a sidebar entry restores that conversation
    Given I have previously sent the message "What is Docker?"
    When I click on "What is Docker?" in the sidebar
    Then the chat window should display the message "What is Docker?"
    And the AI reply to that message should be visible

  # ── Searching history ───────────────────────────────────────────────────

  Scenario: Search returns conversations matching the query term
    Given I have previously sent the messages "Explain async/await" and "What is a promise?"
    When I search for "async"
    Then I should see "Explain async/await" in the search results
    And I should not see "What is a promise?" in the search results

  Scenario: Search with no matches shows an empty results state
    When I search for "xyzzy_no_match_99"
    Then I should see the message "No conversations found"
