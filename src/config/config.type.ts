import { WhiteboardEventLoggingModeType } from './whiteboard.event.logging.mode';

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
  elasticsearch: {
    host: string;
    api_key: string;
    retries: number;
    timeout: number;
    tls: {
      ca_cert_path: string | 'none';
      rejectUnauthorized: boolean;
    };
    indices: {
      whiteboard_events: string;
    };
  };
  monitoring: {
    logging: {
      enabled: boolean;
      level: string;
      json: boolean;
      events: {
        whiteboard_event_index: string;
        interval: number;
        mode: WhiteboardEventLoggingModeType;
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
