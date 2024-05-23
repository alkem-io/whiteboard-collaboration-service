export interface ConfigType {
  rabbitmq: {
    connection: {
      host: string;
      port: number;
      user: string;
      password: string;
    };
  };
  monitoring: {
    logging: {
      enabled: boolean;
      level: string;
      json: boolean;
    };
  };
  settings: {
    application: {
      queue_response_timeout: number;
    };
    collaboration: {
      enabled: boolean;
      port: number;
      contribution_window: number;
      save_interval: number;
      save_timeout: number;
      collaborator_inactivity: number;
      reset_collaborator_mode_debounce: number;
    };
  };
}
