{
  description = "FlowChat — branched LLM chat canvas (Flask + jsPlumb Community Edition)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs?ref=nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: builtins.listToAttrs (map (s: { name = s; value = f s; }) systems);
      pythonFor = system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        pkgs.python3.withPackages (ps: [
          ps.flask
          ps.flask-cors
          ps.openai
          ps.httpx
        ]);
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = [
              (pythonFor system)
              pkgs.nodejs_22
              pkgs.git
            ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkgs.chromium ];
            shellHook = ''
              # Point Puppeteer at Nix's Chromium and skip its own (broken-on-NixOS,
              # Debian-based) Chrome download. macOS keeps the auto-download fallback.
              if [ "$(uname -s)" = Linux ]; then
                export PUPPETEER_EXECUTABLE_PATH="${pkgs.chromium}/bin/chromium"
                export PUPPETEER_SKIP_DOWNLOAD=1
              fi
              echo "FlowChat devShell ready — python3 (Flask) + nodejs + chromium (Puppeteer tests)"
            '';
          };
        });

      apps = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          server = pkgs.writeShellApplication {
            name = "flowchat-server";
            runtimeInputs = [ (pythonFor system) ];
            text = ''exec python3 "${self}/backend/app.py"'';
          };
        in
        {
          default = {
            type = "app";
            program = "${server}/bin/flowchat-server";
            meta.description = "FlowChat — branched LLM chat canvas (Flask dev server)";
          };
        });
    };
}
