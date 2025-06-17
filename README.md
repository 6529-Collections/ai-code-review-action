# My First Action

A basic GitHub Action that outputs a greeting message.

## Usage

```yaml
- uses: ./
  with:
    greeting: 'Hello World'
```

## Inputs

- `greeting`: Optional greeting message (default: "Hello")

## Outputs

- `message`: The formatted greeting message

## Next Steps

1. Run `npm install` to install dependencies
2. Push to GitHub repository
3. Use in workflows with `uses: your-username/repo-name@main`