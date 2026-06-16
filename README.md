# ithildin-cli / ithildin-agent

Make Ithildin **agent-ready**: a CLI + skill so AI agents (Claude, etc.) can
drive the Ithildin operations portal — leads, cold-call dialer, task planner,
and Argent² finances — from the terminal instead of the web UI.

Built with the API → CLI → skill ladder (Nevo David's agent-ready framework).

## Install / run
```bash
export ITHILDIN_API_KEY="ith_..."           # owner-issued key
npx github:Madwr1d/ithildin-agent ping       # run without installing
# or, once published:  npm i -g ithildin-cli  &&  ithildin ping
```

As a Claude agent skill:
```bash
npx skills add Madwr1d/ithildin-agent
```

## Commands
`ping` · `leads list` · `lead-add` · `dialer queue` · `dialer outcome` ·
`planner list` · `planner add` · `argent summary` · `clients list`

See `SKILL.md` for full usage. The key authenticates as the owner; keep it in
your environment.

## License
MIT
