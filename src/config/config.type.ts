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
    elasticsearch: {
      host: string;
      api_key: string;
      retries: number;
      timeout: number;
      indices: {
        whiteboard_events: string;
      };
      tls: {
        ca_cert_path: string | 'none';
        rejectUnauthorized: boolean;
      };
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
      collaborator_inactivity: number;
      reset_collaborator_mode_debounce: number;
    };
    rest: {
      port: number;
    };
  };
}
