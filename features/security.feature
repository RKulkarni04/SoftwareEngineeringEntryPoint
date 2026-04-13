Feature: Security Protection
  Scenario: Account locked after 5 failed login attempts
    Given I am on the login page
    When I fail to login 5 times with "testuser@rutgers.edu"
    Then my account should be temporarily locked
    And I should see a message "Account temporarily locked"

  Scenario: Successful login returns a session token
    Given I am on the login page
    When I enter "testuser@rutgers.edu" and "Password123"
    And I click the login button
    Then I should receive a valid session token