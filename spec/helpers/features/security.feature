Feature: Security Protection
  Scenario: Account locked after 5 failed login attempts
    Given a registered user "lockrunner@test.edu" with password "Password123"
    And I am on the login page
    When I fail to login 5 times with email "lockrunner@test.edu" and wrong password "badpass"
    Then I should see an error message containing "Account temporarily locked"

  Scenario: Successful login returns a session token
    Given I am on the login page
    When I enter "testuser@test.edu" and "password123"
    And I click the login button
    Then I should have a valid session token in storage
