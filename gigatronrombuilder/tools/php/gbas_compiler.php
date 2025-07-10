<?php
/**
 * GBAS Compiler Functions
 * Handles compilation of .gbas files to .gt1 files
 */

class GbasCompiler {
    private $gtbasic_path;
    private $build_dir;

    public function __construct($build_dir = '/var/www/html/phpbb/ext/at67/gigatronrombuilder/tools') {
        $this->build_dir = $build_dir;
        $this->gtbasic_path = $build_dir . '/gtBASIC/gtbasic';
    }

    /**
     * Compile a GBAS file to GT1
     *
     * @param string $gbas_file Path to .gbas file
     * @param string $output_dir Directory for output (optional)
     * @return array Result with success/error info
     */
    public function compile($gbas_file, $output_dir = null) {
        // Change to build directory for compilation
        $old_cwd = getcwd();
        chdir($this->build_dir);

        try {
            // Build command
            $command = './gtBASIC/gtbasic ' . escapeshellarg($gbas_file);

            // Execute compilation
            $output = [];
            $exit_code = 0;
            exec($command . ' 2>&1', $output, $exit_code);

            $result = [
                'success' => $exit_code === 0,
                'exit_code' => $exit_code,
                'output' => implode("\n", $output),
                'command' => $command
            ];

            if ($exit_code === 0) {
                // Success - find the GT1 file
                $gt1_file = $this->findGt1File($gbas_file);
                if ($gt1_file && file_exists($gt1_file)) {
                    $result['gt1_file'] = $gt1_file;
                    $result['gt1_size'] = filesize($gt1_file);

                    // Extract size from output if possible
                    if (preg_match('/\* (.*\.gt1)\s+:\s+0x[0-9a-fA-F]+\s+:\s+(\d+) bytes/', $result['output'], $matches)) {
                        $result['reported_size'] = (int)$matches[2];
                    }
                } else {
                    $result['success'] = false;
                    $result['error'] = 'GT1 file not found after compilation';
                }
            } else {
                // Parse error type
                $result['error_type'] = $this->parseErrorType($exit_code, $result['output']);
                $result['error_message'] = $this->extractErrorMessage($result['output']);
            }

            return $result;

        } finally {
            // Always restore working directory
            chdir($old_cwd);
        }
    }

    /**
     * Determine GT1 filename from GBAS filename
     */
    private function findGt1File($gbas_file) {
        $path_info = pathinfo($gbas_file);
        return $path_info['dirname'] . '/' . $path_info['filename'] . '.gt1';
    }

    /**
     * Parse error type from exit code and output
     */
    private function parseErrorType($exit_code, $output) {
        switch ($exit_code) {
            case 1:
                if (strpos($output, 'Failed to open file') !== false) {
                    return 'file_not_found';
                } else {
                    return 'compilation_error';
                }
            case 2:
                return 'runtime_error';
            case 3:
                return 'usage_error';
            default:
                return 'unknown_error';
        }
    }

    /**
     * Extract human-readable error message
     */
    private function extractErrorMessage($output) {
        $lines = explode("\n", $output);
        $errors = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Look for error patterns
            if (strpos($line, 'Failed to open file') !== false ||
                strpos($line, 'found an unknown symbol') !== false ||
                strpos($line, 'bad initialiser') !== false ||
                strpos($line, 'Usage:') !== false) {
                $errors[] = $line;
            }
        }

        return !empty($errors) ? implode("\n", $errors) : 'Unknown error occurred';
    }
}

// Example usage function
function test_gbas_compiler() {
    $compiler = new GbasCompiler();

    echo "Testing GBAS compiler...\n\n";

    $tests = ['credits.gbas', 'mainmenu.gbas', 'nonexistent.gbas'];

    foreach ($tests as $test_file) {
        echo "--- Testing: $test_file ---\n";
        $result = $compiler->compile($test_file);

        echo "Success: " . ($result['success'] ? 'YES' : 'NO') . "\n";
        echo "Exit Code: " . $result['exit_code'] . "\n";

        if ($result['success']) {
            echo "GT1 File: " . $result['gt1_file'] . "\n";
            echo "Size: " . $result['gt1_size'] . " bytes\n";
        } else {
            echo "Error Type: " . $result['error_type'] . "\n";
            echo "Error: " . $result['error_message'] . "\n";
        }

        echo "\n";
    }
}

// Uncomment to run test
// test_gbas_compiler();
?>
