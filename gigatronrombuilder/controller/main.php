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
        global $phpbb_container;
        $auth = $phpbb_container->get('auth');
        if (!$auth->acl_get('a_'))
        {
            throw new \phpbb\exception\http_exception(403, 'NOT_AUTHORISED');
        }

        $this->template->assign_vars(array('TITLE' => 'Gigatron ROM Builder',));

        return $this->helper->render('rombuilder_main.html', 'Gigatron ROM Builder');
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

            $result = $builder->buildRom($rom_version, $app_overrides, $custom_manifest, $symbols_only);
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

            // Write GBAS source to file
            $gbas_file = __DIR__ . '/../tools/mainmenu.gbas';
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
                $updated_manifest = rtrim($custom_manifest, '"') . ",\n      Main=../tools/" . basename($compile_result['gt1_file']) . '"';

                // DEBUG: Add manifest info to output
                $debug_output = "DEBUG INFO:\n";
                $debug_output .= "Original manifest:\n" . $custom_manifest . "\n\n";
                $debug_output .= "Updated manifest:\n" . $updated_manifest . "\n\n";
                $debug_output .= "GT1 file: " . $compile_result['gt1_file'] . "\n\n";

                // Prepend debug and GBAS compilation output to the ROM build output
                $result = $builder->buildRom($rom_version, [], $updated_manifest, false, $rom_name);
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
}

