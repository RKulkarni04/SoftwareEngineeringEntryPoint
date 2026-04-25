Feature: Sidebar model selection
  In order to control how answers are generated
  As a student user
  I want to use the left sidebar to switch modes and choose models

  Scenario: Switch between single and compare mode
    Given the study room is loaded with available models "llama3,mistral,phi3"
    When I click the "Compare" mode button
    Then the "Compare" mode button should be active
    And the compare guidance should be visible
    When I click the "Single" mode button
    Then the "Single" mode button should be active
    And the compare guidance should be hidden

  Scenario: Select one model in single mode
    Given the study room is loaded with available models "llama3,mistral,phi3"
    When I select the "mistral" model in single mode
    Then only the "mistral" model should be active in the sidebar

  Scenario: Choose which models participate in compare mode
    Given the study room is loaded with available models "llama3,mistral,phi3"
    When I click the "Compare" mode button
    And I deselect the "mistral" model in compare mode
    And I select the "phi3" model in compare mode
    Then exactly 2 models should be selected for comparison
    And the selected comparison models should be "llama3,phi3"
