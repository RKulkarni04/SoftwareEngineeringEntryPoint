Feature: User Login
  Scenario: Successful login
    Given I am on the login page
    When I enter "testuser" and "password123"
    And I click the login button
    Then I should be redirected to the dashboard

  Scenario: Failed login with wrong password
    Given I am on the login page
    When I enter "testuser" and "wrongpassword"
    And I click the login button
    Then I should see an error message