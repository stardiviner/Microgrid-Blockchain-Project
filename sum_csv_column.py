#!/usr/bin/env python -v
# -*- coding: utf-8 -*-

import glob
import csv
import numpy
import pandas as pd
from functools import reduce


# 遍历 data 目录下所有的 csv 文件
csvFiles = list(glob.iglob('data/**/*.csv', recursive=True))


# ==============================================================================
# 获取 csv 文件的所有行
def readCsvColumn(file, column_name):
    "Return a list of specific COLUMN_NAME data in CSV FILE."
    with open(csvFiles[0], "r") as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter=",")
        # print(next(csv_reader))
        # for row in csv_reader:
        #     print(row['use'])
        column = [row[column_name] for row in csv_reader]
    return column


csvFileRowsLength = len(readCsvColumn(csvFiles[0], 'use'))


if csvFileRowsLength == 8834:
    print("Verify CSV file lines correct!")


# ==============================================================================
# 遍历所有 csv 文件，并读取每个文件其中某一列的某一行进行遍历并求和
# def readCsvFilesColumnRow(column_name, row_number):
#     "Return specific ROW_NUMBER data of all CSV files on specific COLUMN_NAME."
#     for csvFile in csvFiles:
#         for column_list in readCsvColumn(csvFile, column_name):
#             column_line_list = list.append(column_list[row_number])
#             return column_line_list
#
#
# readCsvFilesColumnRow('use', 2)

# ==============================================================================
# use numpy to reading CSV file

# get column data
# numpy.genfromtxt(csvFiles[0], dtype=float, delimiter=',', skip_header=True)[1]


columns = []
for csvFile in csvFiles:
    if not csvFile == 'data/metadata-LCOE.csv':
        csvDataArray = numpy.genfromtxt(csvFile, dtype=float, delimiter=',', names=True)
        columns.append(list(csvDataArray['use']))

results = []
for line_tuple in zip(columns):
    results.append(list(line_tuple)[0])

final = reduce(sum, results)

# TODO first test first line sum of all csv files, then convert code into for loop.

# ==============================================================================
# use pandas to reading CSV file
with open("data/household_26.csv", "r") as csvFile:
    csv_reader = csv.csv_reader(csvFile)
    column1 = [row[2] for row in csv_reader]
    print(column1)

# alternative CSV reader
selected_columns = pd.read_csv("data/household_26.csv", usecols=['use'],
                               sep=",",
                               nrows=10)

print(selected_columns)
