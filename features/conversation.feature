Feature: Conversation history and LLM chat
  Scenario: User sends a message and sees assistant reply
    Given I am logged in as "testuser@test.edu" with password "password123"
    And I open the chat page
    When I send the chat message "Hello from E2E"
    Then I should see assistant text containing "Mock assistant"

  Scenario: User searches conversations
    Given I am logged in as "testuser@test.edu" with password "password123"
    And I have a conversation titled with content "UniqueSearchMarker"
    And I open the chat page
    When I search conversations for "UniqueSearchMarker"
    Then I should see a conversation result containing "UniqueSearchMarker"

  Scenario: User continues a previous conversation and sees message history
    Given I am logged in as "testuser@test.edu" with password "password123"
    And I have a conversation titled with content "ContinueChatMarker"
    And I open the chat page
    When I open the conversation containing "ContinueChatMarker" in the sidebar
    Then I should see chat history containing "ContinueChatMarker"
    And I should see assistant text containing "Mock assistant"
