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
            ];
            shellHook = ''
              echo "FlowChat devShell ready — python3 (Flask) + nodejs"
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
