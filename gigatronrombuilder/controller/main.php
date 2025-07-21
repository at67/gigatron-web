<?php

namespace at67\gigatronrombuilder\controller;

class main
{
    protected $helper;
    protected $template;
    protected $user;

    public function __construct(\phpbb\controller\helper $helper, \phpbb\template\template $template, \phpbb\user $user)
    {
        $this->helper = $helper;
        $this->template = $template;
        $this->user = $user;
    }

    public function handle()
    {
        // ADMIN ONLY CHECK
        //global $phpbb_container;
        //$auth = $phpbb_container->get('auth');
        //if (!$auth->acl_get('a_')) {
        //    throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        //}
        // REGISTERED MEMBERS ONLY CHECK
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('u_')) {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        $this->template->assign_vars(array('TITLE' => 'Gigatron ROM Builder',));

        return $this->helper->render('rombuilder_main.html', 'Gigatron ROM Builder');
    }

    private function getUniquePrefix()
    {
        global $phpbb_container;

        // Get the request service from phpBB container
        $request = $phpbb_container->get('request');

        // Enable superglobals temporarily
        $request->enable_super_globals();

        // Start session if not already started
        if (!isset($_SESSION)) {
            session_start();
        }

        if (!isset($_SESSION['build_unique_id'])) {
            $_SESSION['build_unique_id'] = $this->user->data['username'] . '_' . time();
        }

        return $_SESSION['build_unique_id'];
    }

    public function build()
    {
        // Get the JSON data
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        try
        {
            require_once(__DIR__ . '/../tools/php/rom_builder.php');
            $builder = new \RomBuilder();

            // Extract variables from the request data
            $rom_version = $data['rom_version'] ?? '';
            $custom_manifest = $data['manifest'] ?? null;
            $app_overrides = []; // or extract from $data if needed
            $symbols_only = isset($data['symbols_only']) ? $data['symbols_only'] : false;
            $unique_prefix = $this->getUniquePrefix();
            $result = $builder->buildRom($rom_version, $app_overrides, $custom_manifest, null, $symbols_only, false, $unique_prefix);
            $result['unique_prefix'] = $unique_prefix;
        }
        catch (\Exception $e)
        {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $response = new \Symfony\Component\HttpFoundation\JsonResponse($result);
        return $response;
    }

    public function buildMainmenu()
    {
        // Get the JSON data
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);
        try
        {
            // Extract variables from the request data
            $rom_version = $data['rom_version'] ?? '';
            $gbas_source = $data['gbas_source'] ?? '';
            $custom_manifest = $data['manifest'] ?? null;
            $rom_name = $data['rom_name'] ?? null;

            // Write GBAS source to file with unique prefix
            $unique_prefix = $this->getUniquePrefix();
            $gbas_file = __DIR__ . '/../build/' . $unique_prefix . '_mainmenu.gbas';
            file_put_contents($gbas_file, $gbas_source);

            // Compile GBAS to GT1
            require_once(__DIR__ . '/../tools/php/gbas_compiler.php');
            $compiler = new \GbasCompiler();
            $compile_result = $compiler->compile($gbas_file);

            if(!$compile_result['success'])
            {
                $result = ['success' => false, 'error' => 'GBAS compilation failed', 'output' => "GBAS Compilation Output:\n" . $compile_result['output'] . "\n\nGBAS Source:\n" . $gbas_source];
            }
            else
            {
                // Build ROM with compiled mainmenu
                require_once(__DIR__ . '/../tools/php/rom_builder.php');
                $builder = new \RomBuilder();

                // Remove the closing quote, add comma + Main entry, then add closing quote back
                $updated_manifest = rtrim($custom_manifest, '"') . ",\n      Main=../build/" . $unique_prefix . "_mainmenu.gt1" . '"';

                // DEBUG: Add manifest info to output
                $debug_output = "Manifest:\n" . $updated_manifest . "\n\n";

                // Prepend debug and GBAS compilation output to the ROM build output
                $result = $builder->buildRom($rom_version, [], $updated_manifest, $rom_name, false, false, $unique_prefix);
                $result['unique_prefix'] = $unique_prefix;
                $result['output'] = $debug_output . "GBAS Compilation:\n" . $compile_result['output'] . "\n\nROM Build:\n" . $result['output'];
            }
        }
        catch(\Exception $e)
        {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $response = new \Symfony\Component\HttpFoundation\JsonResponse($result);
        return $response;
    }

    public function getRomFreeSpace()
    {
        // Get the JSON data
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        try
        {
            require_once(__DIR__ . '/../tools/php/rom_builder.php');
            $builder = new \RomBuilder();

            // Extract variables from the request data
            $rom_version = $data['rom_version'] ?? '';
            $custom_manifest = $data['manifest'] ?? null;
            $app_overrides = [];

            $result = $builder->buildRom($rom_version, $app_overrides, $custom_manifest, null, false, true);
        }
        catch (\Exception $e)
        {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $response = new \Symfony\Component\HttpFoundation\JsonResponse($result);
        return $response;
    }

    public function download($filename)
    {
        try {
            require_once(__DIR__ . '/../tools/php/rom_builder.php');
            $builder = new \RomBuilder();

            $build_dir = $builder->getBuildDir();
            $rom_file = $build_dir . '/' . $filename;
            $lst_file = $build_dir . '/' . str_replace('.rom', '.lst', $filename);

            if (!file_exists($rom_file)) {
                throw new \Exception("ROM file not found: $filename");
            }

            // Create ZIP in /tmp
            $zip_name = str_replace('.rom', '.zip', $filename);
            $zip_path = '/tmp/' . $zip_name;

            $zip = new \ZipArchive();
            if ($zip->open($zip_path, \ZipArchive::CREATE) !== TRUE) {
                throw new \Exception("Cannot create ZIP file");
            }

            // Add ROM file
            $zip->addFile($rom_file, $filename);

            // Add LST file if it exists
            if (file_exists($lst_file)) {
                $zip->addFile($lst_file, str_replace('.rom', '.lst', $filename));
            }

            $zip->close();

            // Serve the ZIP file
            $response = new \Symfony\Component\HttpFoundation\BinaryFileResponse($zip_path);
            $response->setContentDisposition(
                \Symfony\Component\HttpFoundation\ResponseHeaderBag::DISPOSITION_ATTACHMENT,
                $zip_name
            );
            $response->deleteFileAfterSend(true);

            return $response;

        } catch (\Exception $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
            $response = new \Symfony\Component\HttpFoundation\JsonResponse($result);
            return $response;
        }
    }

    public function serveRom($filename)
    {
        try {
            require_once(__DIR__ . '/../tools/php/rom_builder.php');
            $builder = new \RomBuilder();

            $build_dir = $builder->getBuildDir();
            $rom_file = $build_dir . '/' . $filename;

            if (!file_exists($rom_file)) {
                throw new \Exception("ROM file not found: $filename");
            }

            $response = new \Symfony\Component\HttpFoundation\BinaryFileResponse($rom_file);
            $response->headers->set('Content-Type', 'application/octet-stream');

            return $response;

        } catch (\Exception $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
            $response = new \Symfony\Component\HttpFoundation\JsonResponse($result);
            return $response;
        }
    }
}

