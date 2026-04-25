# features/multi_model_chat.feature
#
# User Story 1: Multi-Model AI Chat Interface
# "As a user, I want to send a single message to multiple LLMs simultaneously
#  and view their answers all together so I can compare the outputs and
#  pick the best answer based on my query."

Feature: Multi-Model AI Chat Interface
  As an authenticated user
  I want to send one prompt to multiple LLMs at the same time
  So that I can compare their answers and pick the most useful one

  Background:
    Given I am logged in as "testuser@rutgers.edu" with password "Password123"
    And I am on the chat page

  Scenario: Send a prompt to two LLMs and see both responses
    When I type "What is machine learning?" into the prompt input
    And I select the models "llama3" and "mistral"
    And I click the "Send to All" button
    Then I should see a response panel labeled "llama3"
    And I should see a response panel labeled "mistral"
    And each panel should contain a non-empty reply

  Scenario: Send a prompt to three LLMs simultaneously
    When I type "Explain recursion in one sentence" into the prompt input
    And I select the models "llama3", "mistral", and "gemma"
    And I click the "Send to All" button
    Then I should see 3 response panels
    And all panels should load before I can submit another query

  Scenario: One model errors but others still respond
    Given the model "bad-model" is unavailable
    When I type "Hello" into the prompt input
    And I select the models "llama3" and "bad-model"
    And I click the "Send to All" button
    Then I should see a response panel labeled "llama3" with a reply
    And I should see a panel labeled "bad-model" showing an error message

  Scenario: Cannot submit a query without selecting at least one model
    When I type "Test question" into the prompt input
    And I do not select any models
    And I click the "Send to All" button
    Then I should see the error "Please select at least one model"
    And no response panels should appear

  Scenario: Cannot submit an empty prompt
    When I leave the prompt input blank
    And I select the model "llama3"
    And I click the "Send to All" button
    Then I should see the error "Please enter a message"
    And no response panels should appear

  Scenario: Multi-model query is saved to conversation history
    When I type "What is Node.js?" into the prompt input
    And I select the models "llama3" and "mistral"
    And I click the "Send to All" button
    Then the query "What is Node.js?" should appear in my conversation history
