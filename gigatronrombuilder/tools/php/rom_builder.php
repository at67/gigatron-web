<?php

class RomBuilder {
    private $base_dir;
    private $romsrc_dir;
    private $romdeps_dir;
    private $build_dir;

    public function __construct($base_dir = '/var/www/html/phpbb/ext/at67/gigatronrombuilder') {
        $this->base_dir = $base_dir;
        $this->romsrc_dir = $base_dir . '/romsrc';
        $this->romdeps_dir = $base_dir . '/romdeps';
        $this->build_dir = $base_dir . '/build';

        // Ensure build directory exists
        if (!is_dir($this->build_dir)) {
            mkdir($this->build_dir, 0755, true);
        }
    }

    public function buildRom($rom_version, $app_overrides = [], $custom_manifest = null) {
        $script_name = "ROM{$rom_version}.asm.py";
        $script_path = $this->romsrc_dir . '/' . $script_name;

        if (!file_exists($script_path)) {
            return [
                'success' => false,
                'error' => "ROM script not found: $script_path"
            ];
        }

        // Change to romsrc directory for build
        $old_cwd = getcwd();
        chdir($this->romsrc_dir);

        try {
            $this->createTempSymlinks();

            // Build the command
            $command = "python3 $script_name";

            // Add app files as arguments
            if ($custom_manifest !== null) {
                try {
                    $parsed = parse_ini_string($custom_manifest, true);
                    $section = "ROM$rom_version";
                    $apps_string = $parsed[$section]['apps'];
                    $apps = $this->parseCustomApps($apps_string);
                    $apps = array_merge($apps, $app_overrides);
                } catch (\Throwable $e) {
                    return [
                        'success' => false,
                        'error' => 'Custom manifest parsing failed: ' . $e->getMessage(),
                        'manifest_received' => $custom_manifest,
                        'rom_version' => $rom_version
                    ];
                }
            } else {
                $apps = $this->getRomApps($rom_version, $app_overrides);
            }
            foreach ($apps as $app) {
                $command .= ' ' . escapeshellarg($app);
            }

            // Execute the build
            $output = [];
            $exit_code = 0;

            // Set PYTHONPATH to include our dependencies
            $python_path = implode(':', [
                $this->romdeps_dir . '/pyasm',
                $this->romdeps_dir . '/Core/font',
                $this->romdeps_dir . '/Apps/Loader',
                $this->romdeps_dir . '/Apps/Racer',
                $this->romsrc_dir
            ]);

            $env = $_ENV;
            $env['PYTHONPATH'] = $python_path;

            // Execute with modified environment
            $descriptors = [
                0 => ["pipe", "r"],
                1 => ["pipe", "w"],
                2 => ["pipe", "w"]
            ];

            $process = proc_open($command, $descriptors, $pipes, null, $env);
            $output_str = stream_get_contents($pipes[1]);
            $error_str = stream_get_contents($pipes[2]);
            $exit_code = proc_close($process);

            $output = explode("\n", trim($output_str . $error_str));

            $result = [
                'success' => $exit_code === 0,
                'exit_code' => $exit_code,
                'command' => $command,
                'output' => implode("\n", $output)
            ];

            if ($exit_code === 0) {
                // Move generated files to build directory
                $this->moveOutputFiles($rom_version);
                $result['rom_file'] = $this->build_dir . "/ROM{$rom_version}.rom";
                $result['lst_file'] = $this->build_dir . "/ROM{$rom_version}.lst";
            }

            return $result;

        } finally {
            // Always restore working directory
            $this->cleanupTempSymlinks();
            chdir($old_cwd);
        }
    }

    private function parseCustomApps($apps_string) {
        // Split by comma and clean up entries
        $entries = explode(',', $apps_string);
        $apps = [];

        foreach ($entries as $entry) {
            // Remove newlines, extra spaces, and trim
            $entry = trim(str_replace(["\n", "\r"], '', $entry));
            if (!empty($entry)) {
                $apps[] = $entry;
            }
        }

        return $apps;
    }

    private function getRomApps($rom_version, $overrides = []) {
        $manifest_file = $this->romsrc_dir . '/manifest.ini';

        if (!file_exists($manifest_file)) {
            throw new Exception("Manifest file not found: $manifest_file");
        }

        $manifest = parse_ini_file($manifest_file, true);
        $section = "ROM$rom_version";

        if (!isset($manifest[$section])) {
            throw new Exception("ROM version $rom_version not found in manifest");
        }

        $apps = explode(',', $manifest[$section]['apps']);

        // Just trim whitespace and return - let symlinks handle paths
        $trimmed_apps = [];
        foreach ($apps as $app) {
            $trimmed_apps[] = trim($app);
        }

        return array_merge($trimmed_apps, $overrides);
    }

    private function moveOutputFiles($rom_version) {
        $files_to_move = [
            "ROM{$rom_version}.rom",
            "ROM{$rom_version}.lst",
            "SymbolTable.m"
        ];

        foreach ($files_to_move as $file) {
            if (file_exists($this->romsrc_dir . '/' . $file)) {
                rename(
                    $this->romsrc_dir . '/' . $file,
                    $this->build_dir . '/' . $file
                );
            }
        }
    }

    private function createTempSymlinks() {
        $apps_link = $this->romsrc_dir . '/Apps';
        if (!file_exists($apps_link)) {
            symlink('../romdeps/Apps', $apps_link);
        }

        $core_link = $this->romsrc_dir . '/Core';
        if (!file_exists($core_link)) {
            symlink('../romdeps/Core', $core_link);
        }

        $games_link = $this->romsrc_dir . '/games';
        if (!file_exists($games_link)) {
            symlink('../../gigatronemulator/gt1/games', $games_link);
        }
    }

    private function cleanupTempSymlinks() {
        $apps_link = $this->romsrc_dir . '/Apps';
        if (is_link($apps_link)) {
            unlink($apps_link);
        }

        $core_link = $this->romsrc_dir . '/Core';
        if (is_link($core_link)) {
            unlink($core_link);
        }

        $games_link = $this->romsrc_dir . '/games';
        if (is_link($games_link)) {
            unlink($games_link);
        }
    }
}

// Test function
function test_rom_builder($version = 'v1') {
    echo "Testing ROM Builder...\n\n";

    $builder = new RomBuilder();

    $result = $builder->buildRom($version);
    echo "--- Building ROM$version ---\n";

    echo "Success: " . ($result['success'] ? 'YES' : 'NO') . "\n";
    echo "Exit Code: " . $result['exit_code'] . "\n";
    echo "Command: " . $result['command'] . "\n\n";

    if ($result['success']) {
        echo "ROM File: " . $result['rom_file'] . "\n";
        echo "LST File: " . $result['lst_file'] . "\n";
        if (file_exists($result['rom_file'])) {
            echo "ROM Size: " . filesize($result['rom_file']) . " bytes\n";
        }
    } else {
        echo "Build Output:\n" . $result['output'] . "\n";
    }
}

// Uncomment to run test
// test_rom_builder();
?>
