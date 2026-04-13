Feature: User Sign Up
  Scenario: Successful account creation
    Given I am on the signup page
    When I enter a new email "newuser@rutgers.edu" and password "Password123"
    And I click the signup button
    Then my account should be created
    And I should be redirected to the dashboard

  Scenario: Duplicate email rejected
    Given I am on the signup page
    When I enter an existing email "existing@rutgers.edu" and password "Password123"
    And I click the signup button
    Then I should see an error "Email already in use"
    