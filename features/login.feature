Feature: User Login
  Scenario: Successful login
    Given I am on the login page
    When I enter "testuser@test.edu" and "EntryPoint_Tst_9fK2mQx!"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should have a valid session token in storage

  Scenario: Failed login with wrong password
    Given I am on the login page
    When I enter "testuser@test.edu" and "wrongpassword"
    And I click the login button
    Then I should see an error message
