Feature: User Sign Up
  Scenario: Successful account creation
    Given I am on the signup page
    When I sign up as a new unique user
    Then I should be redirected to the dashboard


  Scenario: Duplicate email rejected
    Given I am on the signup page
    When I enter signup name "Someone", email "existing@test.edu", password "Password123"
    And I click the signup submit button
    Then I should see signup error "Email already in use"
