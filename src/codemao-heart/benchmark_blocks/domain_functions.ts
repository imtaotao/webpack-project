import { Dict } from '../basic_types';
import { FunctionDict, FunctionDictFactory } from '../block_provider';
import { BenchmarkTool } from '../public_interfaces';

export function get_domain_functions(
    benchmark_deps:BenchmarkTool,
) : FunctionDictFactory {

  const b = benchmark_deps;

  const domain_functions:FunctionDict = {

    set(args, interpreter_id, entity_id, internals) {
      if (args.key == 'Method' || args.key == 'Time') {
        throw new Error('Only the benchmark runner may set the Method and Time columns.');
      }
      b.set(args.key, args.value);
    },

    start_iteration(args, interpreter_id, entity_id, internals) {
      b.start_iteration();
    },

    finish_iteration(args, interpreter_id, entity_id, internals) {
      b.finish_iteration();
    },

  };

  return () => domain_functions;
}
