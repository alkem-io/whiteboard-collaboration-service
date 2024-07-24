export interface ConfigType {
  rabbitmq: {
    connection: {
      host: string;
      port: number;
      user: string;
      password: string;
      heartbeat: number;
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
      queue: string;
      queue_response_timeout: number;
    };
    collaboration: {
      enabled: boolean;
      port: number;
      contribution_window: number;
      save_interval: number;
      save_timeout: number;
      save_consecutive_failed_attempts: number;
      collaborator_inactivity: number;
      reset_collaborator_mode_debounce: number;
    };
    rest: {
      port: number;
    };
  };
}
