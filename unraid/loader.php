<?PHP
if (defined('MCMM_UI_LOADER_RENDERED')) {
  return;
}
define('MCMM_UI_LOADER_RENDERED', true);

$mcmmRoot = '/plugins/mcmm-ui';
$mcmmIndex = "$docroot$mcmmRoot/index.html";
?>

<? if (!is_file($mcmmIndex)): ?>
  <p class="notice">MCMM UI could not be loaded because index.html is missing.</p>
<? else: ?>
  <script>
    window.listview ??= () => {};
    window.loadlist ??= () => {};
  </script>

  <style>
    html,
    body {
      height: 100%;
      overflow: hidden;
    }

    #displaybox {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .Theme--sidebar #displaybox {
      padding-left: 8rem !important;
    }

    #displaybox > .content {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }

    #displaybox > .content > .title,
    #footer {
      display: none !important;
    }

    #mcmm-docker-page,
    #mcmm-ui {
      display: block;
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
    }

    #mcmm-docker-page {
      height: 100%;
      overflow: hidden;
    }

    #mcmm-ui {
      height: 100vh;
      background: var(--background-color, #111);
    }
  </style>

  <div id="mcmm-docker-page">
    <iframe
      id="mcmm-ui"
      title="MCMM Docker interface"
      src="<?=$mcmmRoot?>/index.html?v=<?=filemtime($mcmmIndex)?>"
    ></iframe>
  </div>

  <script>
    (() => {
      const frame = document.getElementById('mcmm-ui');

      const exposeContext = () => {
        const token = typeof csrf_token === 'string' ? csrf_token : '';
        frame.contentWindow.mcmmUnraidContext = { csrfToken: token };
      };

      const fitFrame = () => {
        const top = frame.getBoundingClientRect().top;
        frame.style.height = `${Math.max(0, window.innerHeight - top)}px`;
      };

      fitFrame();
      requestAnimationFrame(fitFrame);
      frame.addEventListener('load', exposeContext);
      window.addEventListener('resize', fitFrame, { passive: true });
    })();
  </script>
<? endif; ?>
