# The workflow

    edge                main
      ^ \                 ^
      |  \------2--\      |
      1             \     3
      |              \    |
    development <-4--   patch

1. Releasing a new 'edge' version.
2. Moving an 'edge' version to stable.
3. Releasing a stable version
4. Aligning bug fixes with the new features.