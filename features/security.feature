Feature: Security Protection
  Scenario: Account locked after 5 failed login attempts
    Given a registered user "lockrunner@test.edu" with password "EntryPoint_Tst_9fK2mQx!"
    And I am on the login page
    When I fail to login 5 times with email "lockrunner@test.edu" and wrong password "badpass"
    Then I should see an error message containing "Account temporarily locked"
