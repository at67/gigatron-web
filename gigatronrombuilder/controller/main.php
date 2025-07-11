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

        try {
            require_once(__DIR__ . '/../tools/php/rom_builder.php');
            $builder = new \RomBuilder();

            // Extract variables from the request data
            $rom_version = $data['rom_version'] ?? '';
            $custom_manifest = $data['manifest'] ?? null;
            $app_overrides = []; // or extract from $data if needed
            $symbols_only = isset($data['symbols_only']) ? $data['symbols_only'] : false;

            $result = $builder->buildRom($rom_version, $app_overrides, $custom_manifest, $symbols_only);
        } catch (\Exception $e) {
            $result = ['success' => false, 'error' => $e->getMessage()];
        }

        $response = new \Symfony\Component\HttpFoundation\JsonResponse($result);
        return $response;
    }
}
