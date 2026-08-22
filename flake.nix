{
  description = "FlowChat — branched LLM chat canvas (Flask + jsPlumb Community Edition)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs?ref=nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: builtins.listToAttrs (map (s: { name = s; value = f s; }) systems);
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          python = pkgs.python3.withPackages (ps: [
            ps.flask
            ps.flask-cors
            ps.openai
            ps.httpx
            ps.python-dotenv
          ]);
        in
        {
          default = pkgs.mkShell {
            packages = [
              python
              pkgs.nodejs_22
              pkgs.git
            ];
            shellHook = ''
              echo "FlowChat devShell ready — python3 (Flask) + nodejs"
            '';
          };
        });
    };
}
