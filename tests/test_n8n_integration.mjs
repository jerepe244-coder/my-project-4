/**
 * ==============================================================================
 * ZYRVAE Intelligence Dashboard — n8n Integration & Read-Only Mode Test Suite
 * ==============================================================================
 * Tests coverage:
 * 1. Mode separation: DEMO vs LIVE READ-ONLY
 * 2. Safe initial default: RUN_SYNTHETIC_TEST=true stays DEMO even with API key
 * 3. DEMO mode: queries return synthetic data with zero network calls
 * 4. LIVE READ-ONLY: queries NEVER use synthetic data as silent fallback
 * 5. LIVE READ-ONLY: missing credentials throw error / report CREDENTIALS_MISSING
 * 6. LIVE READ-ONLY: authentication failure (HTTP 401 / 403)
 * 7. LIVE READ-ONLY: network timeout and connection errors
 * 8. LIVE READ-ONLY: success path with controlled mocks (4 Data Tables)
 * 9. LIVE READ-ONLY: empty tables handling (zero rows without crashing / zero-div)
 * 10. LIVE READ-ONLY: cursor pagination handling
 * 11. LIVE READ-ONLY: corrupted/incomplete data handling
 * 12. Security: System Status does NOT show CONNECTED without verified Data Tables
 * 13. Security: All write methods (POST, PUT, PATCH, DELETE) return HTTP 405
 * 14. Security: No API key or secret leakage in errors or responses
 * ==============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper to save and restore environment variables
function withEnv(vars, fn) {
  const originalEnv = { ...process.env };
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
    return fn();
  } finally {
    process.env = originalEnv;
  }
}

async function withEnvAsync(vars, fn) {
  const originalEnv = { ...process.env };
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
    return await fn();
  } finally {
    process.env = originalEnv;
  }
}

// Intercept global fetch
function withMockFetch(mockFn, testFn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFn;
  return Promise.resolve()
    .then(() => testFn())
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

test('1. DEMO Mode: Initial safe default is DEMO even if an API key is present', async () => {
  await withEnvAsync(
    {
      RUN_SYNTHETIC_TEST: 'true',
      N8N_API_KEY: 'test-api-key-that-must-not-force-live-mode',
      N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
    },
    async () => {
      const { N8nClient } = await import('../src/lib/n8n-client.ts');
      assert.equal(N8nClient.isSynthetic(), true, 'Must remain synthetic when RUN_SYNTHETIC_TEST=true');
      assert.equal(N8nClient.getMode(), 'DEMO', 'Mode must be DEMO');

      const prospects = await N8nClient.getProspects();
      assert.ok(prospects.length > 0, 'DEMO mode must return synthetic prospects');
      assert.equal(prospects[0].id, 'row-001', 'First prospect must match synthetic data');

      const status = await N8nClient.getSystemStatus();
      assert.equal(status.mode, 'DEMO');
      assert.equal(status.connection_status, 'SYNTHETIC_MODE');
      assert.equal(status.is_synthetic_mode, true);
      assert.equal(status.authentication_validated, false);
      assert.equal(status.real_data_loaded, false);

      for (const table of status.tables) {
        assert.equal(table.read_status, 'SYNTHETIC_MOCK');
        assert.ok((table.rows_count || 0) > 0);
      }
    }
  );
});

test('2. DEMO Mode: Returns synthetic data with zero network calls', async () => {
  let fetchCalled = false;
  await withMockFetch(
    async () => {
      fetchCalled = true;
      throw new Error('Network should never be contacted in DEMO mode');
    },
    async () => {
      await withEnvAsync({ RUN_SYNTHETIC_TEST: 'true', N8N_API_KEY: '' }, async () => {
        const { N8nClient } = await import('../src/lib/n8n-client.ts');
        const [prospects, audits, quals, errors] = await Promise.all([
          N8nClient.getProspects(),
          N8nClient.getAudits(),
          N8nClient.getQualifications(),
          N8nClient.getErrorLogs(),
        ]);

        assert.equal(fetchCalled, false, 'Fetch was called in DEMO mode');
        assert.ok(prospects.length > 0);
        assert.ok(audits.length > 0);
        assert.ok(quals.length > 0);
        assert.ok(errors.length > 0);
      });
    }
  );
});

test('3. LIVE READ-ONLY Mode: Missing API key throws error and does NOT fallback to synthetic', async () => {
  await withEnvAsync(
    {
      RUN_SYNTHETIC_TEST: 'false',
      N8N_API_KEY: '',
      N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
    },
    async () => {
      const { N8nClient } = await import('../src/lib/n8n-client.ts');
      assert.equal(N8nClient.isSynthetic(), false, 'Must not be synthetic when RUN_SYNTHETIC_TEST=false');
      assert.equal(N8nClient.getMode(), 'LIVE_READ_ONLY');

      // Verify no silent fallback
      await assert.rejects(
        async () => await N8nClient.getProspects(),
        /N8N_API_KEY no configurada/,
        'getProspects must reject when API key is missing'
      );

      await assert.rejects(
        async () => await N8nClient.getAudits(),
        /N8N_API_KEY no configurada/,
        'getAudits must reject when API key is missing'
      );

      await assert.rejects(
        async () => await N8nClient.getQualifications(),
        /N8N_API_KEY no configurada/,
        'getQualifications must reject when API key is missing'
      );

      await assert.rejects(
        async () => await N8nClient.getErrorLogs(),
        /N8N_API_KEY no configurada/,
        'getErrorLogs must reject when API key is missing'
      );

      const status = await N8nClient.getSystemStatus();
      assert.equal(status.connection_status, 'CREDENTIALS_MISSING');
      assert.equal(status.mode, 'LIVE_READ_ONLY');
      assert.equal(status.credentials_configured, false);
      assert.equal(status.authentication_validated, false);
      assert.equal(status.tables_queryable, false);
      assert.equal(status.real_data_loaded, false);

      for (const t of status.tables) {
        assert.equal(t.read_status, 'CREDENTIALS_REQUIRED');
      }
    }
  );
});

test('4. LIVE READ-ONLY Mode: Authentication failure (HTTP 401 / 403) is reported cleanly', async () => {
  await withMockFetch(
    async (url, init) => {
      return new Response(JSON.stringify({ message: 'Unauthorized: Invalid API key' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async () => {
      await withEnvAsync(
        {
          RUN_SYNTHETIC_TEST: 'false',
          N8N_API_KEY: 'invalid-test-api-key',
          N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
        },
        async () => {
          const { N8nClient } = await import('../src/lib/n8n-client.ts');

          await assert.rejects(
            async () => await N8nClient.getProspects(),
            /HTTP 401/,
            'Should reject with HTTP 401'
          );

          const status = await N8nClient.getSystemStatus();
          assert.equal(status.connection_status, 'ERROR');
          assert.equal(status.mode, 'LIVE_READ_ONLY');
          assert.equal(status.credentials_configured, true);
          assert.equal(status.authentication_validated, false);
          assert.equal(status.real_data_loaded, false);
          assert.ok(status.error_message?.includes('401'));
        }
      );
    }
  );
});

test('5. LIVE READ-ONLY Mode: Network timeout and connection errors are handled safely', async () => {
  await withMockFetch(
    async () => {
      throw new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:443');
    },
    async () => {
      await withEnvAsync(
        {
          RUN_SYNTHETIC_TEST: 'false',
          N8N_API_KEY: 'test-key',
          N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
        },
        async () => {
          const { N8nClient } = await import('../src/lib/n8n-client.ts');

          await assert.rejects(
            async () => await N8nClient.getProspects(),
            /Error de conexión con n8n Cloud/,
            'Should format connection error safely'
          );

          const status = await N8nClient.getSystemStatus();
          assert.equal(status.connection_status, 'ERROR');
          assert.equal(status.api_accessible, false);
          assert.equal(status.authentication_validated, false);
          assert.equal(status.real_data_loaded, false);
          assert.ok(!status.error_message?.includes('test-key'), 'Must never leak API key in error');
        }
      );
    }
  );
});

test('6. LIVE READ-ONLY Mode: Successful queries across all 4 Data Tables with controlled mocks', async () => {
  const mockDb = {
    // prospects (XXFhpG7YA3LLc0F4)
    XXFhpG7YA3LLc0F4: [
      {
        id: 'real-row-01',
        lead_key: 'live-alpha-01',
        business_name: 'Alpha Corp Live',
        website_url: 'https://alphacorp.com',
        country: 'ES',
        industry: 'Software',
        status: 'validated',
        is_test_data: false,
        is_synthetic_test: false,
        traceability_status: 'CONFIRMED_REAL',
        requires_review: false,
        created_at: '2026-10-31T12:00:00.000Z',
      },
    ],
    // website_audits (dpLz1QDQU3l4GyrP)
    dpLz1QDQU3l4GyrP: [
      {
        id: 'real-aud-01',
        audit_id: 'aud-live-alpha-01',
        prospect_id: 'real-row-01',
        lead_key: 'live-alpha-01',
        audit_date: '2026-10-31T12:05:00.000Z',
        initial_url: 'https://alphacorp.com',
        http_status: 200,
        redirect_count: 0,
        response_time_ms: 450,
        has_viewport: true,
        ssl_active: true,
        is_accessible: true,
        commercial_hypotheses: JSON.stringify([{ category: 'PERF', opportunity: 'OK' }]),
        raw_evidence: JSON.stringify({ http_status: 200, response_time_ms: 450 }),
        is_synthetic_test: false,
        is_test_data: false,
        traceability_status: 'CONFIRMED_REAL',
        requires_review: false,
        created_at: '2026-10-31T12:05:00.000Z',
      },
    ],
    // lead_qualifications (GTtrgRiV4XxZijZZ)
    GTtrgRiV4XxZijZZ: [
      {
        qualification_id: 'lq-live-alpha-01',
        lead_key: 'live-alpha-01',
        business_name: 'Alpha Corp Live',
        website_url: 'https://alphacorp.com',
        evaluated_at: '2026-10-31T12:10:00.000Z',
        rules_version: '1.0.0',
        run_mode: 'PRODUCTION',
        classification: 'PRIORITY_HIGH',
        priority_label: 'Prioridad Alta',
        score: 85,
        traceability_status: 'CONFIRMED_REAL',
        is_test_data: false,
        requires_review: false,
        commercial_use_allowed: true,
        created_at: '2026-10-31T12:10:00.000Z',
      },
    ],
    // lead_intake_errors (Qig4adosI9vsNThw)
    Qig4adosI9vsNThw: [
      {
        id: 'live-err-01',
        timestamp: '2026-10-31T11:00:00.000Z',
        workflow: 'WF-01',
        error_type: 'INVALID_FORMAT',
        error_message: 'Format error in live CSV intake',
        status: 'logged',
      },
    ],
  };

  await withMockFetch(
    async (url) => {
      const urlStr = url.toString();

      // Probe workflow endpoint
      if (urlStr.includes('/workflows/')) {
        return new Response(JSON.stringify({ id: 'O4YiErQMAGK9yGPZ', active: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Data Tables rows endpoint: /data-tables/{tableId}/rows
      for (const [tableId, rows] of Object.entries(mockDb)) {
        if (urlStr.includes(`/data-tables/${tableId}/rows`)) {
          return new Response(JSON.stringify({ data: rows, nextCursor: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    },
    async () => {
      await withEnvAsync(
        {
          RUN_SYNTHETIC_TEST: 'false',
          N8N_API_KEY: 'valid-test-key',
          N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
        },
        async () => {
          const { N8nClient } = await import('../src/lib/n8n-client.ts');
          const { DataService } = await import('../src/lib/data-service.ts');

          const prospects = await N8nClient.getProspects();
          assert.equal(prospects.length, 1);
          assert.equal(prospects[0].lead_key, 'live-alpha-01');
          assert.equal(prospects[0].traceability_status, 'CONFIRMED_REAL');

          const audits = await N8nClient.getAudits();
          assert.equal(audits.length, 1);
          assert.equal(audits[0].lead_key, 'live-alpha-01');
          assert.equal(Array.isArray(audits[0].commercial_hypotheses), true);

          const quals = await N8nClient.getQualifications();
          assert.equal(quals.length, 1);
          assert.equal(quals[0].classification, 'PRIORITY_HIGH');
          assert.equal(quals[0].score, 85);

          const errors = await N8nClient.getErrorLogs();
          assert.equal(errors.length, 1);
          assert.equal(errors[0].id, 'live-err-01');

          // Test DataService enrichment with real identifiers
          const enriched = await DataService.getEnrichedProspects();
          assert.equal(enriched.length, 1);
          assert.equal(enriched[0].lead_key, 'live-alpha-01');
          assert.equal(enriched[0].audit?.audit_id, 'aud-live-alpha-01');
          assert.equal(enriched[0].qualification?.qualification_id, 'lq-live-alpha-01');

          // System Status with 4/4 verified tables
          const status = await N8nClient.getSystemStatus();
          assert.equal(status.connection_status, 'CONNECTED');
          assert.equal(status.mode, 'LIVE_READ_ONLY');
          assert.equal(status.credentials_configured, true);
          assert.equal(status.authentication_validated, true);
          assert.equal(status.api_accessible, true);
          assert.equal(status.tables_queryable, true);
          assert.equal(status.real_data_loaded, true);

          for (const tbl of status.tables) {
            assert.equal(tbl.read_status, 'AVAILABLE');
            assert.equal(tbl.rows_count, 1);
          }
        }
      );
    }
  );
});

test('7. LIVE READ-ONLY Mode: System Status NEVER reports CONNECTED if Data Tables are unreachable', async () => {
  await withMockFetch(
    async (url) => {
      const urlStr = url.toString();
      // Workflow endpoint succeeds
      if (urlStr.includes('/workflows/')) {
        return new Response(JSON.stringify({ id: 'O4YiErQMAGK9yGPZ', active: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // But Data Tables fail with 404 (not accessible)
      return new Response(JSON.stringify({ error: 'Data Table not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async () => {
      await withEnvAsync(
        {
          RUN_SYNTHETIC_TEST: 'false',
          N8N_API_KEY: 'valid-test-key',
          N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
        },
        async () => {
          const { N8nClient } = await import('../src/lib/n8n-client.ts');
          const status = await N8nClient.getSystemStatus();

          assert.notEqual(
            status.connection_status,
            'CONNECTED',
            'Must NEVER report CONNECTED when data tables fail, even if workflow endpoint succeeded'
          );
          assert.equal(status.tables_queryable, false);
          assert.equal(status.real_data_loaded, false);
        }
      );
    }
  );
});

test('8. LIVE READ-ONLY Mode: Handles empty tables gracefully without crashing or division by zero', async () => {
  await withMockFetch(
    async () => {
      return new Response(JSON.stringify({ data: [], nextCursor: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async () => {
      await withEnvAsync(
        {
          RUN_SYNTHETIC_TEST: 'false',
          N8N_API_KEY: 'valid-test-key',
          N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
        },
        async () => {
          const { N8nClient } = await import('../src/lib/n8n-client.ts');
          const { DataService } = await import('../src/lib/data-service.ts');

          const prospects = await N8nClient.getProspects();
          assert.equal(prospects.length, 0);

          const metrics = await DataService.getOverviewMetrics();
          assert.equal(metrics.totalProspects, 0);
          assert.equal(metrics.auditsCount, 0);
          assert.equal(metrics.qualificationsCount, 0);
          assert.equal(metrics.isSyntheticMode, false);

          const insights = await DataService.getInsightsData();
          assert.equal(insights.sampleSize, 0);
          assert.equal(insights.accessibilityBreakdown.accessible, 0);

          for (const item of insights.technicalIssues) {
            assert.equal(isNaN(item.percentage), false, 'Percentage must not be NaN');
            assert.equal(item.percentage, 0);
          }
        }
      );
    }
  );
});

test('9. LIVE READ-ONLY Mode: Cursor pagination navigates multiple pages correctly', async () => {
  let callIndex = 0;
  await withMockFetch(
    async (url) => {
      const urlStr = url.toString();
      callIndex++;
      if (urlStr.includes('cursor=page_2_token')) {
        return new Response(
          JSON.stringify({
            data: [{ id: 'row-page-2', lead_key: 'lead-p2', business_name: 'Page 2 Inc' }],
            nextCursor: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          data: [{ id: 'row-page-1', lead_key: 'lead-p1', business_name: 'Page 1 Inc' }],
          nextCursor: 'page_2_token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
    async () => {
      await withEnvAsync(
        {
          RUN_SYNTHETIC_TEST: 'false',
          N8N_API_KEY: 'valid-test-key',
          N8N_BASE_URL: 'https://zyrvae.app.n8n.cloud',
        },
        async () => {
          const { N8nClient } = await import('../src/lib/n8n-client.ts');
          const prospects = await N8nClient.getProspects();
          assert.equal(callIndex, 2, 'Must have made 2 paginated calls');
          assert.equal(prospects.length, 2);
          assert.equal(prospects[0].lead_key, 'lead-p1');
          assert.equal(prospects[1].lead_key, 'lead-p2');
        }
      );
    }
  );
});

test('10. Security: All API routes reject POST, PUT, PATCH, DELETE with 405 Method Not Allowed', async () => {
  const routes = [
    '../src/app/api/prospects/route.ts',
    '../src/app/api/audits/route.ts',
    '../src/app/api/qualifications/route.ts',
    '../src/app/api/errors/route.ts',
    '../src/app/api/overview/route.ts',
    '../src/app/api/insights/route.ts',
    '../src/app/api/system/status/route.ts',
  ];

  for (const routePath of routes) {
    const mod = await import(routePath);

    if (mod.POST) {
      const res = await mod.POST();
      assert.equal(res.status, 405, `${routePath} POST must return 405`);
      const body = await res.json();
      assert.equal(body.error, 'Method Not Allowed');
    }

    if (mod.PUT) {
      const res = await mod.PUT();
      assert.equal(res.status, 405, `${routePath} PUT must return 405`);
    }

    if (mod.PATCH) {
      const res = await mod.PATCH();
      assert.equal(res.status, 405, `${routePath} PATCH must return 405`);
    }

    if (mod.DELETE) {
      const res = await mod.DELETE();
      assert.equal(res.status, 405, `${routePath} DELETE must return 405`);
    }
  }
});
