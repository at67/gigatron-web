<?php
namespace at67\gigatronemulator\controller;

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

        $this->template->assign_vars(array(
            'EMULATOR_BASE_PATH' => '/ext/at67/gigatronemulator/emulator/',
        ));

        return $this->helper->render('gigatronemulator_main.html', 'Gigatron Emulator');
    }
}
