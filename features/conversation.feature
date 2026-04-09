Feature: Conversation history and LLM chat
  Scenario: User sends a message and sees assistant reply
    Given I am logged in as "testuser@test.edu" with password "EntryPoint_Tst_9fK2mQx!"
    And I open the chat page
    When I send the chat message "Hello from E2E"
    Then I should see assistant text containing "Mock assistant"

  Scenario: User searches conversations
    Given I am logged in as "testuser@test.edu" with password "EntryPoint_Tst_9fK2mQx!"
    And I have a conversation titled with content "UniqueSearchMarker"
    And I open the chat page
    When I search conversations for "UniqueSearchMarker"
    Then I should see a conversation result containing "UniqueSearchMarker"

  Scenario: User continues the same conversation after switching to a new chat
    Given I am logged in as "testuser@test.edu" with password "EntryPoint_Tst_9fK2mQx!"
    And I open the chat page
    When I send the chat message "who are you?"
    Then I should see assistant text containing "Mock assistant"
    When I start a new empty chat
    And I open the conversation containing "who are you?" in the sidebar
    Then I should see chat history containing "who are you?"
    And I should see assistant text containing "Mock assistant"
    When I send the chat message "How is rutgers?"
    Then I should see chat history containing "How is rutgers?"
    And I should see assistant text containing "Mock assistant"
