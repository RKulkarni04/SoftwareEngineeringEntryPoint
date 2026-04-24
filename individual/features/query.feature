Feature: Multi-model query

  Scenario: User submits a prompt to both models
    Given I am on the query page
    When I type "What is gravity?" in the input box
    And I select both Llama3 and Mistral
    And I click Send
    Then I should see a response from Llama3
    And I should see a response from Mistral

  Scenario: User submits an empty prompt
    Given I am on the query page
    When I leave the input box empty
    And I click Send
    Then I should see an error message "Please enter a prompt"

  Scenario: User selects only one model
    Given I am on the query page
    When I type "What is gravity?" in the input box
    And I select only Llama3
    And I click Send
    Then I should see a response from Llama3
    And the Mistral panel should remain hidden

  Scenario: User selects no models
    Given I am on the query page
    When I type "What is gravity?" in the input box
    And I select no models
    And I click Send
    Then I should see an error message "Please select at least one model"