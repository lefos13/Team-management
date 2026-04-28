# Task Import Instructions

Use the task import flow from the Tasks page. Select the target project first, then download either the blank or sample Excel template for that project.

## Workbook Format

- File type: `.xlsx`
- Maximum size: 5 MB
- Required sheet name: `Tasks`
- Header row must be row 1 and must match this order:
  - `Title`
  - `Member Emails`
  - `Deadline`
  - `Description`
  - `Status`
  - `Defect`
  - `Start Date`

## Required Fields

- `Title`: task title.
- `Member Emails`: one or more emails of active members already assigned to the selected project. Separate multiple emails with commas or semicolons.
- `Deadline`: Excel date/datetime or ISO-like date string.

## Optional Fields

- `Description`: free text.
- `Status`: `todo`, `in_progress`, `blocked`, or `done`. Human labels like `To Do` and `In Progress` are accepted.
- `Defect`: `yes/no`, `true/false`, or blank. Blank means `false`.
- `Start Date`: Excel date/datetime or ISO-like date string.

## Date Rules

- Date-only `Start Date` values are imported at `09:00`.
- Date-only `Deadline` values are imported at `17:00`.
- `Start Date` must be before `Deadline`.

## Safety And Validation

The server checks the file before creating tasks:

- Only one `.xlsx` file is accepted.
- The workbook must have the correct `Tasks` sheet and headers.
- All rows are validated before any database insert happens.
- Member emails must belong to active members assigned to the selected project.
- Invalid rows reject the whole import and no tasks are created.
- Duplicate rows are skipped when an existing task in the selected project has the same title, assignee set, and deadline.

## Recommended Workflow

1. Open Tasks.
2. Click Import.
3. Select the project.
4. Download the blank or sample template.
5. Fill the `Tasks` sheet.
6. Upload the completed `.xlsx`.
7. Review the import summary.
