<?php

namespace at67\gigatronemulator\event;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class main_listener implements EventSubscriberInterface
{
    protected $helper;
    protected $template;

    public function __construct(\phpbb\controller\helper $helper, \phpbb\template\template $template)
    {
        $this->helper = $helper;
        $this->template = $template;
    }

    public static function getSubscribedEvents()
    {
        return array(
            'core.page_header'  => 'add_page_header_link',
        );
    }

    public function add_page_header_link($event)
    {
        $this->template->assign_vars(array(
	    'U_GIGATRON_EMULATOR' => $this->helper->route('at67_gigatronemulator_main'),
        ));
    }
}
