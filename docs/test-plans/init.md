# Test plan: init

Source: `git diff` and `git diff --cached` (current branch is `init`, so `git diff init...HEAD` is empty)
Base: working tree
Every row is **not yet tested**.

Nothing changed. The working-tree diff and the index diff are both empty, so there is nothing to prove.

## Cypress component tests

None.

## Cypress UI tests

None.

## Playwright E2E tests

None.

## Playwright API tests

None.

`GET /openapi.json` was not fetched. There are no API rows, so no status codes or `rule` values were needed.

## Accessibility tests

None.

## Seen, no test

None.
