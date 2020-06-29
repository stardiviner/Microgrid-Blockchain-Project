#!/usr/bin/env python -v
# -*- coding: utf-8 -*-

import os
import glob
import csv

csv_path = 'data'


def safe_int(number):
    try:
        return int(number)
    except ValueError:
        return 0


total = []
for csvfile in glob.iglob('data/**/*.csv', recursive=True):
    data = []
    with open(csvfile, 'r') as f:
        print("reading file: %s", f)
        csvreader = csv.reader(f, delimiter=',')
        for row in csvreader:
            data.append(safe_int(row[1]))
    total.append(data)

# DONE
# with open('data/household_1103.csv', "r") as csv_file:
#     csvreader = csv.reader(csv_file, delimiter=',')
#     for row in csvreader:
#         print(row[1])

result = []
for item in zip(total):
    result.append(sum(item))

# print(result)
