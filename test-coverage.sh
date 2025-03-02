#!/bin/bash

# Run all tests with coverage
npx vitest run --coverage

# To run specific tests with coverage, uncomment and modify the line below
# npx vitest run server/lib/openai.test.ts server/lib/slack.test.ts --coverage