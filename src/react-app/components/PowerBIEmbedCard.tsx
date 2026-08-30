import React, { useEffect, useState } from 'react';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';

interface EmbedConfig {
  reportId: string;
  embedUrl: string;
  accessToken: string;
}

export const PowerBIEmbedCard: React.FC = () => {
  const [config, setConfig] = useState<EmbedConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the Service Principal embed token from your FastAPI backend
    fetch('/api/powerbi/embed-token')
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load Power BI embed token');
        }
        return res.json();
      })
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-[650px] border rounded-lg bg-gray-50 text-gray-500">
        Loading Power BI Dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-[650px] border rounded-lg bg-red-50 text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="w-full h-[650px] border rounded-lg shadow-sm overflow-hidden bg-white">
      {config && (
        <PowerBIEmbed
          embedConfig={{
            type: 'report', // Can be 'report', 'dashboard', or 'tile'
            id: config.reportId,
            embedUrl: config.embedUrl,
            accessToken: config.accessToken,
            tokenType: models.TokenType.Embed,
            settings: {
              panes: {
                filters: {
                  expanded: false,
                  visible: true
                },
                pageNavigation: {
                  visible: true
                }
              },
              background: models.BackgroundType.Transparent,
            }
          }}
          cssClassName="w-full h-full"
        />
      )}
    </div>
  );
};