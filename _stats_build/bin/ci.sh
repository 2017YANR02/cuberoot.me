#!/bin/bash

changed_statistic_files=`git diff --name-only $GITHUB_SHA~1..$GITHUB_SHA | grep 'statistics/' | grep -v 'statistics/index.rb'`

if [[ "$GITHUB_EVENT_NAME" != "schedule" && "$GITHUB_EVENT_NAME" != "workflow_dispatch" && "$changed_statistic_files" == "" ]]; then
  echo "There is nothing to compute."
else
  # Set up database.
  bin/init.rb
  printf "database: \"wca_statistics\"\nusername: \"root\"\npassword: \"root\"" > database.yml
  bin/update_database.rb
  # When a cron job compute all statistics, otherwise just the updated and new ones.
  if [[ "$GITHUB_EVENT_NAME" == "schedule" || "$GITHUB_EVENT_NAME" == "workflow_dispatch" ]]; then
    bin/compute_all.rb || exit 1
  else
    echo "$changed_statistic_files" | while read file; do
      echo "File has changed: $file"
      bin/compute.rb $file || exit 1
    done
  fi
  # Update the index file in both cases.
  bin/compute_index.rb
  # Add the GitHub repository link in the corner of each page.
  github_repo_slug="${GITHUB_REPOSITORY:-jonatanklosko/wca_statistics}"
  github_corner_template_html=`cat bin/templates/github_corner.html`
  github_corner_html="${github_corner_template_html/"<<<GITHUB_REPO_SLUG>>>"/$github_repo_slug}"
  grep --files-without-match "github-corner" build/* | while read file; do
    echo -e "\n\n$github_corner_html" >> $file
  done
fi
