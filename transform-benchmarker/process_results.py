#!/usr/bin/env python3

# This script loads Octane scores and file sizes from the results/
# folder and aggregates them into two CSVs: one representing score-
# related measurements and another representing size-related measurements.

import csv
from itertools import islice


def read_results(file_name):
    """Reads a CSV file containing results. Produces a mapping of benchmark
       names to numerical results."""
    results = {}
    with open(file_name, 'r') as csvfile:
        spamreader = csv.reader(csvfile, delimiter=',', quotechar='|')
        for row in islice(spamreader, 1, None):
            results[row[0]] = float(row[1])
    return results


def aggregate_results(baseline, *others):
    """Aggregates results. Takes a baseline and a number of other measurements,
       divides all measurements by the baseline on a per-benchmark basis."""

    def aggregate_benchmark(key, results):
        if key in results:
            return results[key] / baseline[key]
        else:
            return 0.0

    results = []
    for key in sorted(baseline.keys()):
        results.append((key, 1.0) + tuple(aggregate_benchmark(key, xs)
                                          for xs in others))
    return results


def aggregate_category(baseline_file, *other_files):
    """Aggregates result files for a particular category of benchmarks."""
    baseline = read_results(baseline_file)
    others = [read_results(name) for name in other_files]
    return aggregate_results(baseline, *others)


def write_aggregated(destination, aggregated, *names):
    """Writes aggregated results back to a CSV file."""
    with open(destination, 'w') as csvfile:
        fieldnames = ['benchmark'] + list(names)
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()
        for row in aggregated:
            writer.writerow(
                {key: value for key, value in zip(fieldnames, row)})

    # We'll return a dictionary that maps names to their mean scores
    # relative to the baseline.
    results = {key: 0.0 for key in names}
    count = 0
    for row in aggregated:
        if 0.0 in row[1:]:
            # This benchmark errored for at least one instrumentation
            # technique. We'll drop it entirely in the interest of fairness.
            continue

        for key, value in zip(names, row[1:]):
            results[key] += value

        count += 1

    for key in names:
        results[key] /= count

    return results

print("Score means:")
print(
    write_aggregated(
        'results/scores.csv',
        aggregate_category('results/original-scores.csv',
                           'results/flash-freeze-scores.csv',
                           'results/things-js-scores.csv'),
        'original',
        'flash-freeze',
        'things-js'))

print("Size means:")
print(
    write_aggregated(
        'results/sizes.csv',
        aggregate_category('results/original-sizes.csv',
                           'results/flash-freeze-sizes.csv',
                           'results/things-js-sizes.csv'),
        'original',
        'flash-freeze',
        'things-js'))
