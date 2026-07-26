{
  description = "Gardner Vickers' Obsidian-powered Quartz blog";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { nixpkgs, ... }:
    let
      systems = [ "aarch64-darwin" "x86_64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in {
      devShells = forAllSystems (system: let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        default = pkgs.mkShell {
          packages = [
            pkgs.git
            pkgs.nodejs_22
          ];
        };
      });

      apps = forAllSystems (system: let
        pkgs = nixpkgs.legacyPackages.${system};
        mkBlogCommand = name: command: {
          type = "app";
          program = "${pkgs.writeShellApplication {
            inherit name;
            runtimeInputs = [
              pkgs.git
              pkgs.nodejs_22
            ];
            text = ''
              if [[ ! -d node_modules ]]; then
                npm ci
              fi
              ${command}
            '';
          }}/bin/${name}";
        };
      in {
        default = mkBlogCommand "blog-preview" "npm run preview";
        preview = mkBlogCommand "blog-preview" "npm run preview";
        publish = mkBlogCommand "blog-publish" "npm run publish";
        check = mkBlogCommand "blog-check" "npm run site:build";
      });
    };
}
