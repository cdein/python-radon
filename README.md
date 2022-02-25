# python-radon

The python radon extension shows the complexity and rating of a class, method or function inline of the source code.

## Requirements

You need to install python-radon at a minimum version 5.1:

`pip install "radon>=5.1"`

## Metrics

See the [radon documentation](https://radon.readthedocs.io/en/latest/intro.html) to understand the rating and complextity values presented by the extension.

### Maintainability Index

|MI score   |Rank   |Maintainability |
|-----------|-------|----------------|
|100 - 20   |A      |Very high       |
|19 - 10    |B      |Medium          |
|9 - 0      |C      |Extremely low   |

### Cyclomatic Complexity

|CC score   |Rank   |Risk                                   |
|-----------|-------|---------------------------------------|
|1 - 5      |A      |low - simple block                     |
|6 - 10     |B      |low - well structured and stable block |
|11 - 20    |C      |moderate - slightly complex block      |
|21 - 30    |D      |more than moderate - more complex block|
|31 - 40    |E      |high - complex block, alarming         |
|41+        |F      |very high - error-prone, unstable block|

## Extension Settings

This extension contributes the following settings:

- `python.radon.enable`: enable/disable this extension
- `python.radon.executable`: set to a path to your radon executable, e.g. `/usr/bin/radon`

## Credits

[Complex icons created by Flat Icons - Flaticon](https://www.flaticon.com/free-icons/complex)

## Release Notes

### 1.0.3

Show the maintainability index of the current source code in the status bar

### 1.0.2

Allow editing settings when executable couldn't be found and the documentation was extended

### 1.0.1

Added the complexity icon [Complex icons created by Flat Icons - Flaticon](https://www.flaticon.com/free-icons/complex)

### 1.0.0

Initial release of Python radon
