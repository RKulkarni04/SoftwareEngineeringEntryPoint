# features/security.feature
#
# User Story 3: Security Protection
# "As the system, I want to temporarily lock a user's account after
#  5 failed login attempts to prevent hackers' brute-force attempts."

Feature: Security Protection — Account Lockout
  As the system
  I want to lock user accounts after 5 failed login attempts
  So that brute-force attacks cannot compromise user credentials

  Background:
    Given a registered user with email "testuser@rutgers.edu" and password "Password123"

  # ── Attempt counting ─────────────────────────────────────────────────────

  Scenario: 1st failed attempt — 4 remaining, account NOT locked
    Given I am on the login page
    When I enter "testuser@rutgers.edu" and "WrongPass1"
    And I click the login button
    Then I should see an error message containing "4 attempt(s) remaining"
    And the account should not be locked

  Scenario: 2nd failed attempt — 3 remaining
    Given the user "testuser@rutgers.edu" has already failed 1 login attempt
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "WrongPass2"
    And I click the login button
    Then I should see an error message containing "3 attempt(s) remaining"

  Scenario: 3rd failed attempt — 2 remaining
    Given the user "testuser@rutgers.edu" has already failed 2 login attempts
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "WrongPass3"
    And I click the login button
    Then I should see an error message containing "2 attempt(s) remaining"

  Scenario: 4th failed attempt — 1 remaining
    Given the user "testuser@rutgers.edu" has already failed 3 login attempts
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "WrongPass4"
    And I click the login button
    Then I should see an error message containing "1 attempt(s) remaining"

  # ── Lock trigger ─────────────────────────────────────────────────────────

  Scenario: Account locked after 5 failed login attempts
    Given the user "testuser@rutgers.edu" has already failed 4 login attempts
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "WrongPass5"
    And I click the login button
    Then my account should be temporarily locked
    And I should see a message containing "Account locked after 5 failed attempts"
    And I should see a message containing "15 minutes"

  Scenario: Locked account rejects login even with the correct password
    Given the user "testuser@rutgers.edu" account is locked
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "Password123"
    And I click the login button
    Then I should see a message containing "Account locked"
    And I should see the remaining lock time in minutes
    And I should not receive a session token

  # ── Lock expiry ─────────────────────────────────────────────────────────

  Scenario: Account auto-unlocks after the lock duration expires
    Given the user "testuser@rutgers.edu" account lock has expired
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "Password123"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should receive a valid session token

  # ── Reset on success ─────────────────────────────────────────────────────

  Scenario: Failed attempt counter resets after a successful login
    Given the user "testuser@rutgers.edu" has already failed 2 login attempts
    And I am on the login page
    When I enter "testuser@rutgers.edu" and "Password123"
    And I click the login button
    Then I should be redirected to the dashboard
    And the failed attempt counter for "testuser@rutgers.edu" should be 0

  # ── Valid login ──────────────────────────────────────────────────────────

  Scenario: Successful login returns a valid session token
    Given I am on the login page
    When I enter "testuser@rutgers.edu" and "Password123"
    And I click the login button
    Then I should be redirected to the dashboard
    And I should receive a valid session token
